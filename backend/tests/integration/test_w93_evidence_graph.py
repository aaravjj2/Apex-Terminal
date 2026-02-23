"""
W93 -- Evidence graph v1 (nodes + edges).
Tests the full stack via HTTP: create edges, traverse graph, backtest provenance.
"""
import uuid
import pytest
import httpx

BASE = "http://localhost:8090"

GRAPH_URL    = f"{BASE}/api/v3/evidence/graph"
EDGE_URL     = f"{BASE}/api/v3/evidence/graph/edge"
BACKTEST_URL = f"{BASE}/api/v3/evidence/graph/backtest"
EDGES_URL    = f"{BASE}/api/v3/evidence/graph/edges"
RESET_URL    = f"{BASE}/api/v3/evidence/graph"


@pytest.fixture(scope="module", autouse=True)
def reset_graph():
    r = httpx.delete(RESET_URL, timeout=15)
    assert r.status_code == 200


class TestGetGraphEndpoint:
    def test_returns_200(self):
        r = httpx.get(GRAPH_URL, params={"root_type": "strategies", "root_id": "x"}, timeout=15)
        assert r.status_code == 200

    def test_schema_has_required_fields(self):
        data = httpx.get(GRAPH_URL, params={"root_type": "strategies", "root_id": "x"}, timeout=15).json()
        for field in ("root_type", "root_id", "nodes", "edges", "node_count", "edge_count"):
            assert field in data

    def test_nodes_is_list(self):
        data = httpx.get(GRAPH_URL, params={"root_type": "strategies", "root_id": "x"}, timeout=15).json()
        assert isinstance(data["nodes"], list)

    def test_edges_is_list(self):
        data = httpx.get(GRAPH_URL, params={"root_type": "strategies", "root_id": "x"}, timeout=15).json()
        assert isinstance(data["edges"], list)

    def test_root_node_always_present(self):
        rid = f"rn-{uuid.uuid4().hex[:8]}"
        data = httpx.get(GRAPH_URL, params={"root_type": "strategies", "root_id": rid}, timeout=15).json()
        entity_ids = [n["entity_id"] for n in data["nodes"]]
        assert rid in entity_ids

    def test_missing_root_type_returns_422(self):
        r = httpx.get(GRAPH_URL, params={"root_id": "x"}, timeout=15)
        assert r.status_code == 422


class TestCreateEdgeEndpoint:
    def test_post_edge_returns_200(self):
        sid, bid = f"ce-{uuid.uuid4().hex[:8]}", f"cb-{uuid.uuid4().hex[:8]}"
        r = httpx.post(EDGE_URL, json={"from_type": "strategies", "from_id": sid, "to_type": "backtests", "to_id": bid, "edge_type": "ran_backtest"}, timeout=15)
        assert r.status_code == 200

    def test_post_edge_ok_true(self):
        sid, bid = f"ce-{uuid.uuid4().hex[:8]}", f"cb-{uuid.uuid4().hex[:8]}"
        data = httpx.post(EDGE_URL, json={"from_type": "strategies", "from_id": sid, "to_type": "backtests", "to_id": bid, "edge_type": "ran_backtest"}, timeout=15).json()
        assert data["ok"] is True

    def test_post_edge_returns_edge_doc(self):
        sid, bid = f"ce-{uuid.uuid4().hex[:8]}", f"cb-{uuid.uuid4().hex[:8]}"
        data = httpx.post(EDGE_URL, json={"from_type": "strategies", "from_id": sid, "to_type": "backtests", "to_id": bid, "edge_type": "ran_backtest"}, timeout=15).json()
        assert "edge" in data
        assert data["edge"]["edge_type"] == "ran_backtest"

    def test_post_edge_appears_in_graph(self):
        sid, bid = f"gv-{uuid.uuid4().hex[:8]}", f"gvb-{uuid.uuid4().hex[:8]}"
        httpx.post(EDGE_URL, json={"from_type": "strategies", "from_id": sid, "to_type": "backtests", "to_id": bid, "edge_type": "ran_backtest"}, timeout=15)
        data = httpx.get(GRAPH_URL, params={"root_type": "strategies", "root_id": sid}, timeout=15).json()
        assert data["edge_count"] >= 1

    def test_post_edge_metadata_preserved(self):
        sid, bid = f"me-{uuid.uuid4().hex[:8]}", f"meb-{uuid.uuid4().hex[:8]}"
        data = httpx.post(EDGE_URL, json={"from_type": "strategies", "from_id": sid, "to_type": "backtests", "to_id": bid, "edge_type": "ran_backtest", "metadata": {"confidence": 0.95}}, timeout=15).json()
        assert data["edge"]["metadata"]["confidence"] == 0.95


class TestBacktestEdgesEndpoint:
    def test_post_backtest_returns_200(self):
        r = httpx.post(BACKTEST_URL, json={"run_id": f"br-{uuid.uuid4().hex[:8]}", "strategy_id": f"bs-{uuid.uuid4().hex[:8]}"}, timeout=15)
        assert r.status_code == 200

    def test_post_backtest_ok_true(self):
        data = httpx.post(BACKTEST_URL, json={"run_id": f"br-{uuid.uuid4().hex[:8]}", "strategy_id": f"bs-{uuid.uuid4().hex[:8]}"}, timeout=15).json()
        assert data["ok"] is True

    def test_post_backtest_creates_two_edges(self):
        data = httpx.post(BACKTEST_URL, json={"run_id": f"br-{uuid.uuid4().hex[:8]}", "strategy_id": f"bs-{uuid.uuid4().hex[:8]}"}, timeout=15).json()
        assert data["count"] == 2

    def test_post_backtest_graph_has_3_nodes(self):
        rid, sid = f"br-{uuid.uuid4().hex[:8]}", f"bs-{uuid.uuid4().hex[:8]}"
        httpx.post(BACKTEST_URL, json={"run_id": rid, "strategy_id": sid}, timeout=15)
        data = httpx.get(GRAPH_URL, params={"root_type": "strategies", "root_id": sid, "max_depth": 3}, timeout=15).json()
        assert data["node_count"] >= 3

    def test_post_backtest_graph_has_2_edges(self):
        rid, sid = f"br-{uuid.uuid4().hex[:8]}", f"bs-{uuid.uuid4().hex[:8]}"
        httpx.post(BACKTEST_URL, json={"run_id": rid, "strategy_id": sid}, timeout=15)
        data = httpx.get(GRAPH_URL, params={"root_type": "strategies", "root_id": sid, "max_depth": 3}, timeout=15).json()
        assert data["edge_count"] >= 2


class TestListEdgesEndpoint:
    def test_get_edges_returns_200(self):
        r = httpx.get(EDGES_URL, timeout=15)
        assert r.status_code == 200

    def test_get_edges_returns_list(self):
        data = httpx.get(EDGES_URL, timeout=15).json()
        assert isinstance(data["edges"], list)

    def test_get_edges_count_matches_list(self):
        data = httpx.get(EDGES_URL, timeout=15).json()
        assert data["count"] == len(data["edges"])

    def test_get_edges_grows_after_insert(self):
        before = httpx.get(EDGES_URL, timeout=15).json()["count"]
        sid, bid = f"grow-{uuid.uuid4().hex[:8]}", f"growb-{uuid.uuid4().hex[:8]}"
        httpx.post(EDGE_URL, json={"from_type": "strategies", "from_id": sid, "to_type": "backtests", "to_id": bid, "edge_type": "ran_backtest"}, timeout=15)
        after = httpx.get(EDGES_URL, timeout=15).json()["count"]
        assert after > before


class TestFullFlow:
    def test_multi_hop_traversal(self):
        sid, bid, eid = f"ff-{uuid.uuid4().hex[:8]}", f"ffb-{uuid.uuid4().hex[:8]}", f"ffe-{uuid.uuid4().hex[:8]}"
        httpx.post(EDGE_URL, json={"from_type": "strategies", "from_id": sid, "to_type": "backtests", "to_id": bid, "edge_type": "ran_backtest"}, timeout=15)
        httpx.post(EDGE_URL, json={"from_type": "backtests", "from_id": bid, "to_type": "events", "to_id": eid, "edge_type": "produced_result"}, timeout=15)
        data = httpx.get(GRAPH_URL, params={"root_type": "strategies", "root_id": sid, "max_depth": 3}, timeout=15).json()
        entity_ids = [n["entity_id"] for n in data["nodes"]]
        assert eid in entity_ids

    def test_backtest_endpoint_full_roundtrip(self):
        rid, sid = f"rt-{uuid.uuid4().hex[:8]}", f"rts-{uuid.uuid4().hex[:8]}"
        httpx.post(BACKTEST_URL, json={"run_id": rid, "strategy_id": sid}, timeout=15)
        data = httpx.get(GRAPH_URL, params={"root_type": "strategies", "root_id": sid}, timeout=15).json()
        assert data["node_count"] > 0
        assert data["edge_count"] > 0

    def test_graph_from_backtest_root(self):
        rid, sid = f"brt-{uuid.uuid4().hex[:8]}", f"brts-{uuid.uuid4().hex[:8]}"
        httpx.post(BACKTEST_URL, json={"run_id": rid, "strategy_id": sid}, timeout=15)
        data = httpx.get(GRAPH_URL, params={"root_type": "backtests", "root_id": rid}, timeout=15).json()
        assert data["edge_count"] >= 1

    def test_reset_clears_all_edges(self):
        sid, bid = f"cl-{uuid.uuid4().hex[:8]}", f"clb-{uuid.uuid4().hex[:8]}"
        httpx.post(EDGE_URL, json={"from_type": "strategies", "from_id": sid, "to_type": "backtests", "to_id": bid, "edge_type": "test"}, timeout=15)
        httpx.delete(RESET_URL, timeout=15)
        data = httpx.get(EDGES_URL, timeout=15).json()
        assert data["count"] == 0

    def test_edges_schema_fields(self):
        sid, bid = f"sf-{uuid.uuid4().hex[:8]}", f"sfb-{uuid.uuid4().hex[:8]}"
        httpx.post(EDGE_URL, json={"from_type": "strategies", "from_id": sid, "to_type": "backtests", "to_id": bid, "edge_type": "test_schema"}, timeout=15)
        data = httpx.get(EDGES_URL, timeout=15).json()
        assert len(data["edges"]) > 0
        edge = data["edges"][0]
        for field in ("id", "from_type", "from_id", "to_type", "to_id", "edge_type"):
            assert field in edge
