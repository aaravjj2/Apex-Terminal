"""
Alpaca Options Adapter (experimental)

Attempts to fetch options chains from Alpaca Data API v1beta1.
If the endpoint is unavailable or the response cannot be parsed, the adapter
returns None so callers can fall back to yfinance.
"""

import logging
from datetime import datetime
from typing import Optional

import requests

from .models import OptionContract, OptionChain, OptionType
from .adapter import DEFAULT_RISK_FREE_RATE
from ..config import get_settings

logger = logging.getLogger(__name__)


class AlpacaOptionsAdapter:
    """Experimental adapter that queries Alpaca Options REST endpoints."""

    DATA_BASE = "https://data.alpaca.markets"

    def __init__(self, risk_free_rate: float = DEFAULT_RISK_FREE_RATE):
        self.risk_free_rate = risk_free_rate
        settings = get_settings()
        self.api_key = settings.apca_api_key_id
        self.api_secret = settings.apca_api_secret_key
        self.session = requests.Session()
        if self.api_key and self.api_secret:
            # Alpaca requires these headers for data endpoints
            self.session.headers.update({
                "APCA-API-KEY-ID": self.api_key,
                "APCA-API-SECRET-KEY": self.api_secret,
            })

    def get_chain(self, symbol: str, expiration: Optional[datetime.date] = None) -> Optional[OptionChain]:
        try:
            # Try multiple endpoint variants to maximize compatibility
            endpoints = [
                f"{self.DATA_BASE}/v1beta1/options/chains",
                f"{self.DATA_BASE}/v1/options/chains",
                f"{self.DATA_BASE}/v1beta1/options/chain",
                f"{self.DATA_BASE}/v1/options/chain",
            ]

            data = None
            successful_url = None
            for url in endpoints:
                try:
                    resp = self.session.get(url, params={"symbol": symbol}, timeout=5)
                except Exception as e:
                    logger.debug("alpaca_options_request_failed", url=url, error=str(e))
                    continue

                if resp.status_code == 200:
                    successful_url = url
                    try:
                        data = resp.json()
                    except Exception:
                        data = None
                    break
                else:
                    logger.debug("alpaca_options_non_200", url=url, code=resp.status_code)

            if data is None:
                logger.info(f"alpaca_options_no_data_for_symbol {symbol}")
                # Attempt to fetch indicative quotes (Basic plan) as a fallback
                indicative_endpoints = [
                    f"{self.DATA_BASE}/v1beta1/options/quotes",
                    f"{self.DATA_BASE}/v1/options/quotes",
                    f"{self.DATA_BASE}/v1beta1/marketdata/options/quotes",
                    f"{self.DATA_BASE}/v1/marketdata/options/quotes",
                ]

                for url in indicative_endpoints:
                    try:
                        resp = self.session.get(url, params={"symbol": symbol}, timeout=5)
                    except Exception as e:
                        logger.debug("alpaca_indicative_request_failed", url=url, error=str(e))
                        continue

                    if resp.status_code != 200:
                        logger.debug("alpaca_indicative_non_200", url=url, code=resp.status_code)
                        continue

                    try:
                        d = resp.json()
                        if isinstance(d, dict):
                            payload = d.get("data") or d
                        else:
                            payload = d
                    except Exception:
                        payload = None

                    if not payload:
                        continue

                    # Parse indicative payload (best-effort)
                    contracts_raw = []
                    expirations_raw = set()

                    # payload might be a list of quote items or a dict with 'quotes'
                    items = []
                    if isinstance(payload, dict):
                        items = payload.get("quotes") or payload.get("data") or []
                        if isinstance(items, dict):
                            # maybe nested keyed by symbol
                            for v in items.values():
                                if isinstance(v, list):
                                    items = v
                                    break
                    elif isinstance(payload, list):
                        items = payload

                    for it in items:
                        try:
                            # Normalize different key names
                            opt_symbol = it.get("contract_symbol") or it.get("symbol") or it.get("contract")
                            strike = float(it.get("strike") or it.get("strike_price") or 0)
                            exp_str = it.get("expiration") or it.get("expiration_date")
                            if not exp_str:
                                continue
                            expirations_raw.add(str(exp_str)[:10])
                            opt_type_raw = it.get("option_type") or it.get("type") or it.get("side")
                            opt_type = 'call' if str(opt_type_raw).lower().startswith('c') else 'put'
                            bid = float(it.get("bid")) if it.get("bid") is not None else None
                            ask = float(it.get("ask")) if it.get("ask") is not None else None
                            last = float(it.get("last")) if it.get("last") is not None else None

                            contracts_raw.append({
                                "contract_symbol": opt_symbol,
                                "option_type": opt_type,
                                "strike": strike,
                                "expiration": str(exp_str)[:10],
                                "bid": bid,
                                "ask": ask,
                                "last": last,
                                "volume": int(it.get("volume") or 0),
                                "open_interest": int(it.get("open_interest") or 0),
                            })
                        except Exception:
                            continue

                    if contracts_raw:
                        expirations_raw = list(expirations_raw)
                        # Build a minimal OptionChain from indicative quotes
                        contracts = []
                        today = datetime.utcnow().date()
                        for item in contracts_raw:
                            try:
                                exp_date = datetime.strptime(item["expiration"], "%Y-%m-%d").date()
                                contract = OptionContract(
                                    symbol=symbol,
                                    contract_symbol=item.get("contract_symbol") or f"{symbol}-{item.get('expiration')}-{item.get('strike')}",
                                    option_type=OptionType.CALL if item.get("option_type") == 'call' else OptionType.PUT,
                                    strike=item.get("strike"),
                                    expiration=exp_date,
                                    bid=item.get("bid"),
                                    ask=item.get("ask"),
                                    last=item.get("last"),
                                    mark=(item.get("bid") + item.get("ask")) / 2 if (item.get("bid") and item.get("ask")) else item.get("last"),
                                    volume=item.get("volume", 0),
                                    open_interest=item.get("open_interest", 0),
                                    implied_volatility=None,
                                    greeks=None,
                                    in_the_money=False,
                                    days_to_expiration=max(0, (exp_date - today).days),
                                )
                                contracts.append(contract)
                            except Exception:
                                continue

                        if contracts:
                            return OptionChain(
                                symbol=symbol,
                                underlying_price=0.0,
                                expirations=[datetime.strptime(e, "%Y-%m-%d").date() for e in expirations_raw],
                                contracts=contracts,
                                timestamp=datetime.utcnow(),
                                provider="alpaca-indicative",
                            )

                # No indicative data either
                return None

            # Best-effort parsing: expect 'contracts' and 'expirations' keys
            if isinstance(data, dict):
                payload = data.get("data") or data
            else:
                payload = data

            if isinstance(payload, dict):
                contracts_raw = payload.get("contracts")
                expirations_raw = payload.get("expirations")
            elif isinstance(payload, list):
                # Payload is already a list of contracts
                contracts_raw = payload
                expirations_raw = None
            else:
                contracts_raw = None
                expirations_raw = None

            if successful_url:
                logger.info("alpaca_options_success", url=successful_url)

            if not contracts_raw:
                logger.info(f"alpaca_options_empty symbol={symbol}")
                return None

            expirations = []
            if expirations_raw:
                for e in expirations_raw:
                    try:
                        expirations.append(datetime.strptime(e, "%Y-%m-%d").date())
                    except Exception:
                        continue

            contracts = []
            for item in contracts_raw:
                try:
                    opt_type_raw = item.get("option_type") or item.get("type") or item.get("side")
                    opt_type = OptionType.CALL if str(opt_type_raw).lower().startswith("c") else OptionType.PUT
                    strike = float(item.get("strike"))
                    exp_str = item.get("expiration") or item.get("expiration_date")
                    exp_date = datetime.strptime(str(exp_str)[:10], "%Y-%m-%d").date()
                    bid = float(item.get("bid")) if item.get("bid") is not None else None
                    ask = float(item.get("ask")) if item.get("ask") is not None else None
                    last = float(item.get("last")) if item.get("last") is not None else None

                    # compute mark
                    if bid is not None and ask is not None:
                        mark = (bid + ask) / 2
                    else:
                        mark = last

                    # volume/oi
                    volume = int(item.get("volume", 0)) if item.get("volume") else 0
                    oi = int(item.get("open_interest", 0)) if item.get("open_interest") else 0

                    # Create OptionContract-like object (thin mapping)
                    contract = OptionContract(
                        symbol=symbol,
                        contract_symbol=item.get("contract_symbol") or item.get("symbol"),
                        option_type=opt_type,
                        strike=strike,
                        expiration=exp_date,
                        bid=bid,
                        ask=ask,
                        last=last,
                        mark=mark,
                        volume=volume,
                        open_interest=oi,
                        implied_volatility=None,
                        greeks=None,
                        in_the_money=False,
                        days_to_expiration=max(0, (exp_date - datetime.utcnow().date()).days),
                    )
                    contracts.append(contract)
                except Exception:
                    continue

            if not contracts:
                return None

            # underlying price may not be returned; set 0 and let callers fetch if needed
            return OptionChain(
                symbol=symbol,
                underlying_price=0.0,
                expirations=expirations,
                contracts=contracts,
                timestamp=datetime.utcnow(),
                provider="alpaca",
            )
        except Exception:
            logger.exception("alpaca_options_error")
            return None