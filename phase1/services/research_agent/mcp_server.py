"""MCP server for Research Agent — exposes 4-node pipeline tools over SSE."""

from __future__ import annotations

import logging
from typing import Any

from .osi_parser import parse_osi
from .state_machine import run_research_agent

logger = logging.getLogger(__name__)

_MCP_INSTANCE: Any | None = None


def build_research_mcp_server() -> Any | None:
    """Build FastMCP server; returns None when mcp/fastmcp is not installed."""
    global _MCP_INSTANCE
    if _MCP_INSTANCE is not None:
        return _MCP_INSTANCE

    FastMCP: Any
    try:
        from mcp.server.fastmcp import FastMCP as _FastMCP
        FastMCP = _FastMCP
    except ImportError:
        try:
            from fastmcp import FastMCP as _FastMCP  # type: ignore
            FastMCP = _FastMCP
        except ImportError:
            logger.info("MCP SDK not installed — research MCP SSE disabled")
            return None

    mcp = FastMCP(
        name="apex-research-agent",
        instructions=(
            "Apex Research Agent — deterministic 4-node state machine. "
            "Tools: parse_osi, run_research_pipeline, research_status."
        ),
    )

    @mcp.tool()
    def research_status() -> dict[str, Any]:
        """Return Research Agent capabilities and node topology."""
        from .sentiment_engine import finbert_available

        return {
            "agent": "research_4_node_state_machine",
            "version": "1.2.0",
            "transport": "sse",
            "finbert_available": finbert_available(),
            "nodes": [
                "orchestrator",
                "quantitative_engine",
                "sentiment_quantization",
                "synthesis_risk",
            ],
        }

    @mcp.tool()
    def parse_osi_symbol(osi_symbol: str) -> dict[str, Any]:
        """Parse a 21-character OSI options symbol into structured components."""
        c = parse_osi(osi_symbol)
        return {
            "osi_symbol": c.osi_symbol,
            "underlying": c.underlying,
            "expiration_date": c.expiration_date.isoformat(),
            "option_type": c.option_type,
            "strike_price": c.strike_price,
        }

    @mcp.tool()
    def run_research_pipeline(
        osi_symbol: str,
        news_text: str = "",
        event_type: str | None = None,
        market_mid: float | None = None,
        trade_plan_id: str | None = None,
        fetch_news: bool = True,
    ) -> dict[str, Any]:
        """Execute the full 4-node Research Agent pipeline and return JSON trade plan."""
        return run_research_agent(
            osi_symbol=osi_symbol,
            news_text=news_text,
            event_type=event_type,
            market_mid=market_mid,
            trade_plan_id=trade_plan_id,
            fetch_news=fetch_news,
        )

    _MCP_INSTANCE = mcp
    return mcp
