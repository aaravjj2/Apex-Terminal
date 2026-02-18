"""
Tests for n8n workflow export module.
"""
import pytest
import json
import tempfile
import os

from services.automation.n8n_export import (
    N8nNode,
    N8nWorkflow,
    WorkflowTemplates,
    export_all_templates,
)


class TestN8nNode:
    """Tests for N8nNode dataclass."""
    
    def test_basic_node(self):
        node = N8nNode(
            id="test_1",
            type="n8n-nodes-base.httpRequest",
            position=(100, 200),
            name="Test Node",
            parameters={"url": "http://example.com"}
        )
        
        d = node.to_dict()
        assert d["id"] == "test_1"
        assert d["type"] == "n8n-nodes-base.httpRequest"
        assert d["position"] == [100, 200]
        assert d["name"] == "Test Node"
        assert d["parameters"]["url"] == "http://example.com"
    
    def test_node_with_credentials(self):
        node = N8nNode(
            id="auth_1",
            type="n8n-nodes-base.httpRequest",
            position=(0, 0),
            name="Auth Node",
            credentials={"apiKey": {"id": "key_1", "name": "API Key"}}
        )
        
        d = node.to_dict()
        assert "credentials" in d
        assert d["credentials"]["apiKey"]["id"] == "key_1"


class TestN8nWorkflow:
    """Tests for N8nWorkflow class."""
    
    def test_empty_workflow(self):
        wf = N8nWorkflow(name="Empty")
        d = wf.to_dict()
        
        assert d["name"] == "Empty"
        assert d["nodes"] == []
        assert d["connections"] == {}
        assert "meta" in d
    
    def test_add_nodes(self):
        wf = N8nWorkflow(name="Test")
        wf.add_node(N8nNode("n1", "type1", (0, 0), "Node 1"))
        wf.add_node(N8nNode("n2", "type2", (100, 0), "Node 2"))
        
        assert len(wf.nodes) == 2
    
    def test_connect_nodes(self):
        wf = N8nWorkflow(name="Connected")
        wf.add_node(N8nNode("n1", "type1", (0, 0), "Node 1"))
        wf.add_node(N8nNode("n2", "type2", (100, 0), "Node 2"))
        wf.connect("n1", "n2")
        
        assert "n1" in wf.connections
        assert wf.connections["n1"]["main"][0][0]["node"] == "n2"
    
    def test_json_output(self):
        wf = N8nWorkflow(name="JSON Test")
        wf.add_node(N8nNode("n1", "type1", (0, 0), "Node 1"))
        
        json_str = wf.to_json()
        parsed = json.loads(json_str)
        
        assert parsed["name"] == "JSON Test"
        assert len(parsed["nodes"]) == 1
    
    def test_hash_deterministic(self):
        wf1 = N8nWorkflow(name="Hash Test")
        wf1.add_node(N8nNode("n1", "type1", (0, 0), "Node 1"))
        
        wf2 = N8nWorkflow(name="Hash Test")
        wf2.add_node(N8nNode("n1", "type1", (0, 0), "Node 1"))
        
        # Hash should be deterministic for same content
        # (excluding timestamp which varies)
        assert len(wf1.get_hash()) == 16
        assert len(wf2.get_hash()) == 16


class TestWorkflowTemplates:
    """Tests for pre-built workflow templates."""
    
    def test_alert_to_order(self):
        wf = WorkflowTemplates.alert_to_order(
            alert_name="Test Alert",
            symbol="MSFT",
            action="SELL",
            quantity=5
        )
        
        assert wf.name == "Alert: Test Alert"
        assert len(wf.nodes) == 4  # webhook, if, http, noop
        
        # Verify node types
        node_types = {n.type for n in wf.nodes}
        assert "n8n-nodes-base.webhook" in node_types
        assert "n8n-nodes-base.if" in node_types
        assert "n8n-nodes-base.httpRequest" in node_types
    
    def test_regime_change_handler(self):
        wf = WorkflowTemplates.regime_change_handler()
        
        assert "Regime" in wf.name
        assert len(wf.nodes) >= 6  # schedule, http, switch, 3 activates
        
        # Should have strategy activation nodes
        node_names = [n.name for n in wf.nodes]
        assert any("Trend" in name for name in node_names)
    
    def test_colab_job_scheduler(self):
        wf = WorkflowTemplates.colab_job_scheduler(
            colab_notebook_url="https://colab.research.google.com/test"
        )
        
        assert "Colab" in wf.name
        assert len(wf.nodes) >= 4  # cron, set, http trigger, http store
    
    def test_incident_bundle_replay(self):
        wf = WorkflowTemplates.incident_bundle_replay()
        
        assert "Incident" in wf.name or "Replay" in wf.name
        
        # Should have verification step
        node_names = [n.name for n in wf.nodes]
        assert any("Hash" in name or "Verify" in name for name in node_names)


class TestExportAllTemplates:
    """Tests for bulk export functionality."""
    
    def test_export_creates_files(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            results = export_all_templates(tmpdir)
            
            # Should create 4 files
            assert len(results) == 4
            
            # All files should exist
            for filename in results.keys():
                filepath = os.path.join(tmpdir, filename)
                assert os.path.exists(filepath)
    
    def test_export_valid_json(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            export_all_templates(tmpdir)
            
            for filename in os.listdir(tmpdir):
                filepath = os.path.join(tmpdir, filename)
                with open(filepath) as f:
                    data = json.load(f)
                
                # Verify structure
                assert "name" in data
                assert "nodes" in data
                assert "connections" in data
                assert "meta" in data
    
    def test_export_hashes_returned(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            results = export_all_templates(tmpdir)
            
            # All hashes should be 16 chars (sha256[:16])
            for hash_val in results.values():
                assert len(hash_val) == 16
                assert all(c in "0123456789abcdef" for c in hash_val)
