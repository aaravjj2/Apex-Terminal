"""Wave 10 — Risk Network Graph: nodes (assets/sectors) and correlation edges."""
import hashlib, json
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/risk-network", tags=["risk-network"])

DEMO_NODES: list = [
    {"id": "n-001", "label": "AAPL",      "type": "stock",    "sector": "Technology",  "risk_score": 0.42, "centrality": 0.81},
    {"id": "n-002", "label": "MSFT",      "type": "stock",    "sector": "Technology",  "risk_score": 0.39, "centrality": 0.79},
    {"id": "n-003", "label": "NVDA",      "type": "stock",    "sector": "Technology",  "risk_score": 0.61, "centrality": 0.74},
    {"id": "n-004", "label": "TSLA",      "type": "stock",    "sector": "Auto",         "risk_score": 0.78, "centrality": 0.52},
    {"id": "n-005", "label": "XLK",       "type": "etf",      "sector": "Technology",  "risk_score": 0.37, "centrality": 0.88},
    {"id": "n-006", "label": "XLE",       "type": "etf",      "sector": "Energy",       "risk_score": 0.55, "centrality": 0.61},
    {"id": "n-007", "label": "TLT",       "type": "bond",     "sector": "Fixed Income", "risk_score": 0.28, "centrality": 0.43},
    {"id": "n-008", "label": "GLD",       "type": "commodity","sector": "Gold",         "risk_score": 0.22, "centrality": 0.35},
    {"id": "n-009", "label": "Tech Risk", "type": "factor",   "sector": "Risk Factor",  "risk_score": 0.58, "centrality": 0.92},
    {"id": "n-010", "label": "Rate Risk", "type": "factor",   "sector": "Risk Factor",  "risk_score": 0.45, "centrality": 0.71},
]

DEMO_EDGES: list = [
    {"source": "n-001", "target": "n-002", "weight": 0.87, "type": "correlation"},
    {"source": "n-001", "target": "n-003", "weight": 0.79, "type": "correlation"},
    {"source": "n-001", "target": "n-005", "weight": 0.91, "type": "membership"},
    {"source": "n-002", "target": "n-003", "weight": 0.82, "type": "correlation"},
    {"source": "n-002", "target": "n-005", "weight": 0.93, "type": "membership"},
    {"source": "n-003", "target": "n-005", "weight": 0.88, "type": "membership"},
    {"source": "n-004", "target": "n-005", "weight": 0.45, "type": "correlation"},
    {"source": "n-005", "target": "n-009", "weight": 0.96, "type": "factor_load"},
    {"source": "n-006", "target": "n-009", "weight": 0.31, "type": "factor_load"},
    {"source": "n-007", "target": "n-010", "weight": 0.88, "type": "factor_load"},
    {"source": "n-008", "target": "n-010", "weight": -0.41,"type": "factor_load"},
    {"source": "n-009", "target": "n-010", "weight": -0.28,"type": "factor_load"},
]

def _hash():
    payload = {"nodes": DEMO_NODES, "edges": DEMO_EDGES}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()

DEMO_HASH = _hash()

@router.get("/graph")
async def get_graph():
    return {"nodes": DEMO_NODES, "edges": DEMO_EDGES, "node_count": len(DEMO_NODES), "edge_count": len(DEMO_EDGES), "hash": DEMO_HASH}

@router.get("/hash")
async def get_hash():
    return {"hash": DEMO_HASH}

@router.get("/nodes")
async def list_nodes():
    return {"nodes": DEMO_NODES, "count": len(DEMO_NODES), "hash": DEMO_HASH}

@router.get("/edges")
async def list_edges():
    return {"edges": DEMO_EDGES, "count": len(DEMO_EDGES), "hash": DEMO_HASH}
