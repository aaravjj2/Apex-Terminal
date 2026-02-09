import pytest
from services.ingestion.connectors.alpaca_ws_connector import AlpacaWSConnector
from services.ingestion.normalizer import TickNormalizer
from services.models import RawTick


def test_parse_nanoseconds_timestamp():
    c = AlpacaWSConnector(api_key="x", api_secret="x")
    ts = "2026-01-12T18:52:11.025339168Z"
    ts_ms = c._parse_ts(ts)
    assert isinstance(ts_ms, int) and ts_ms > 0


@pytest.mark.asyncio
async def test_normalizer_handles_alpaca_ws_source():
    normalizer = TickNormalizer()
    outputs = []

    async def collector(tick):
        outputs.append(tick)

    normalizer.register_callback(collector)

    raw = RawTick(source="alpaca-ws", symbol="AAPL", ts_ms=1768243931025, price=260.45, size=0)
    canonical = await normalizer.process_tick(raw)

    assert canonical is not None
    assert canonical.source.value == "alpaca"
    assert canonical.symbol == "AAPL"
    assert canonical.ts_ms == 1768243931025
    assert len(outputs) == 1


@pytest.mark.asyncio
async def test_alpaca_ws_handle_message_parses_and_emits():
    c = AlpacaWSConnector(api_key="x", api_secret="x")
    emitted = []

    async def cb(tick):
        emitted.append(tick)

    c.register_callback(cb)

    # Simulate a quote message with nanosecond fractional seconds
    msg = "[{'T':'q','S':'AAPL','bp':260.44,'bs':300,'ap':260.47,'as':100,'t':'2026-01-12T18:52:11.025339168Z'}]"

    # The connector._handle_message expects a JSON string, so replace single quotes
    await c._handle_message(msg.replace("'", '"'))

    # Allow some async scheduling
    import asyncio
    await asyncio.sleep(0.01)

    assert len(emitted) == 1
    tick = emitted[0]
    assert tick.source == 'alpaca'
    assert tick.symbol == 'AAPL'
    assert tick.ts_ms > 0


@pytest.mark.asyncio
async def test_safe_send_handles_closed_connection():
    c = AlpacaWSConnector(api_key="x", api_secret="x")

    class DummyWS:
        open = True
        closed = False

        async def send(self, payload):
            raise RuntimeError("send after close")

    c._ws = DummyWS()
    res = await c._safe_send("x")
    assert res is False


@pytest.mark.asyncio
async def test_safe_send_skips_when_not_connected():
    c = AlpacaWSConnector(api_key="x", api_secret="x")
    c._ws = None
    res = await c._safe_send("x")
    assert res is False
