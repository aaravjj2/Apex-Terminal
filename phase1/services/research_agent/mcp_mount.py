"""Mount Research Agent MCP SSE transport on the unified FastAPI app."""

from __future__ import annotations

import logging

from fastapi import FastAPI

from .mcp_server import build_research_mcp_server

logger = logging.getLogger(__name__)

_MCP_MOUNTED = False


def mount_research_mcp_sse(app: FastAPI) -> bool:
    """
    Mount MCP SSE Starlette app at /api/v1/research/mcp.

    Blueprint routes:
      GET  /api/v1/research/mcp/sse     — SSE event stream handshake
      POST /api/v1/research/mcp/messages/ — JSON-RPC message ingestion
    """
    global _MCP_MOUNTED
    if _MCP_MOUNTED:
        return True

    mcp = build_research_mcp_server()
    if mcp is None:
        return False

    if hasattr(mcp, "sse_app"):
        sse_app = mcp.sse_app()
    elif hasattr(mcp, "http_app"):
        try:
            sse_app = mcp.http_app(path="/sse", transport="sse")
        except TypeError:
            sse_app = mcp.http_app(transport="sse")
    else:
        logger.warning("MCP server has no sse_app/http_app — SSE disabled")
        return False

    app.mount("/api/v1/research/mcp", sse_app)
    _MCP_MOUNTED = True
    logger.info("Research Agent MCP SSE mounted at /api/v1/research/mcp")
    return True


def mcp_sse_mounted() -> bool:
    return _MCP_MOUNTED
