"""
n8n Workflow Export Module

Generates n8n-compatible workflow JSON for:
- Alert triggers → Trading actions
- Market regime changes → Strategy switching
- Scheduled data pulls → Colab jobs
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import hashlib


@dataclass
class N8nNode:
    """Represents a single n8n workflow node."""
    id: str
    type: str
    position: tuple
    name: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    credentials: Optional[Dict[str, str]] = None
    
    def to_dict(self) -> dict:
        node = {
            "id": self.id,
            "type": self.type,
            "position": list(self.position),
            "name": self.name,
            "parameters": self.parameters,
        }
        if self.credentials:
            node["credentials"] = self.credentials
        return node


@dataclass
class N8nConnection:
    """Connection between nodes."""
    source_node: str
    source_output: int
    target_node: str
    target_input: int


@dataclass
class N8nWorkflow:
    """Complete n8n workflow definition."""
    name: str
    nodes: List[N8nNode] = field(default_factory=list)
    connections: Dict[str, Any] = field(default_factory=dict)
    
    def add_node(self, node: N8nNode):
        self.nodes.append(node)
    
    def connect(self, source: str, target: str, source_output: int = 0, target_input: int = 0):
        if source not in self.connections:
            self.connections[source] = {"main": [[]]}
        
        # Extend arrays if needed
        while len(self.connections[source]["main"]) <= source_output:
            self.connections[source]["main"].append([])
        
        self.connections[source]["main"][source_output].append({
            "node": target,
            "type": "main",
            "index": target_input
        })
    
    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "nodes": [n.to_dict() for n in self.nodes],
            "connections": self.connections,
            "settings": {
                "executionOrder": "v1"
            },
            "meta": {
                "exportedAt": datetime.utcnow().isoformat() + "Z",
                "generator": "tradingview-recreation",
                "version": "1.0.0"
            }
        }
    
    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)
    
    def get_hash(self) -> str:
        """Generate deterministic hash for verification."""
        content = json.dumps(self.to_dict(), sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:16]


class WorkflowTemplates:
    """Pre-built workflow templates for common trading automation patterns."""
    
    @staticmethod
    def alert_to_order(
        alert_name: str = "Price Alert",
        symbol: str = "AAPL",
        condition: str = "price > 200",
        action: str = "BUY",
        quantity: int = 10,
        api_endpoint: str = "http://localhost:8000"
    ) -> N8nWorkflow:
        """
        Template: Alert triggers → API call to place order.
        
        Flow: Webhook Trigger → IF condition → HTTP Request (order)
        """
        workflow = N8nWorkflow(name=f"Alert: {alert_name}")
        
        # 1. Webhook trigger (receives alert data)
        webhook = N8nNode(
            id="webhook_1",
            type="n8n-nodes-base.webhook",
            position=(250, 300),
            name="Alert Webhook",
            parameters={
                "path": f"alerts/{symbol.lower()}",
                "httpMethod": "POST",
            }
        )
        workflow.add_node(webhook)
        
        # 2. IF node (check condition)
        condition_node = N8nNode(
            id="if_1",
            type="n8n-nodes-base.if",
            position=(450, 300),
            name="Check Condition",
            parameters={
                "conditions": {
                    "string": [{
                        "value1": "={{ $json.condition_met }}",
                        "operation": "equals",
                        "value2": "true"
                    }]
                }
            }
        )
        workflow.add_node(condition_node)
        workflow.connect("webhook_1", "if_1")
        
        # 3. HTTP Request (place order)
        order_node = N8nNode(
            id="http_1",
            type="n8n-nodes-base.httpRequest",
            position=(650, 200),
            name="Place Order",
            parameters={
                "method": "POST",
                "url": f"{api_endpoint}/api/v1/orders",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "symbol", "value": symbol},
                        {"name": "side", "value": action.lower()},
                        {"name": "quantity", "value": str(quantity)},
                        {"name": "order_type", "value": "market"},
                    ]
                },
                "options": {}
            }
        )
        workflow.add_node(order_node)
        workflow.connect("if_1", "http_1", source_output=0)  # True branch
        
        # 4. No-op for false branch
        noop = N8nNode(
            id="noop_1",
            type="n8n-nodes-base.noOp",
            position=(650, 400),
            name="No Action",
            parameters={}
        )
        workflow.add_node(noop)
        workflow.connect("if_1", "noop_1", source_output=1)  # False branch
        
        return workflow
    
    @staticmethod
    def regime_change_handler(
        api_endpoint: str = "http://localhost:8000"
    ) -> N8nWorkflow:
        """
        Template: Market regime change → Strategy switching.
        
        Flow: Schedule → Fetch Regime → Switch Strategies
        """
        workflow = N8nWorkflow(name="Regime Change Handler")
        
        # 1. Schedule trigger (every 5 minutes)
        schedule = N8nNode(
            id="schedule_1",
            type="n8n-nodes-base.scheduleTrigger",
            position=(250, 300),
            name="Every 5 Minutes",
            parameters={
                "rule": {
                    "interval": [{"field": "minutes", "minutesInterval": 5}]
                }
            }
        )
        workflow.add_node(schedule)
        
        # 2. Fetch current regime
        fetch_regime = N8nNode(
            id="http_regime",
            type="n8n-nodes-base.httpRequest",
            position=(450, 300),
            name="Fetch Regime",
            parameters={
                "method": "GET",
                "url": f"{api_endpoint}/api/v1/regime/current",
                "options": {}
            }
        )
        workflow.add_node(fetch_regime)
        workflow.connect("schedule_1", "http_regime")
        
        # 3. Switch node based on regime
        switch_node = N8nNode(
            id="switch_1",
            type="n8n-nodes-base.switch",
            position=(650, 300),
            name="Route by Regime",
            parameters={
                "dataType": "string",
                "value1": "={{ $json.regime }}",
                "rules": {
                    "rules": [
                        {"value": "trending", "output": 0},
                        {"value": "choppy", "output": 1},
                        {"value": "volatile", "output": 2},
                    ]
                }
            }
        )
        workflow.add_node(switch_node)
        workflow.connect("http_regime", "switch_1")
        
        # 4. Strategy activation endpoints
        strategies = ["trend_following", "mean_reversion", "volatility_capture"]
        for i, strat in enumerate(strategies):
            activate = N8nNode(
                id=f"activate_{i}",
                type="n8n-nodes-base.httpRequest",
                position=(850, 200 + i * 150),
                name=f"Activate {strat.replace('_', ' ').title()}",
                parameters={
                    "method": "POST",
                    "url": f"{api_endpoint}/api/v1/strategies/{strat}/activate",
                    "options": {}
                }
            )
            workflow.add_node(activate)
            workflow.connect("switch_1", f"activate_{i}", source_output=i)
        
        return workflow
    
    @staticmethod
    def colab_job_scheduler(
        colab_notebook_url: str = "",
        schedule_cron: str = "0 */6 * * *"  # Every 6 hours
    ) -> N8nWorkflow:
        """
        Template: Scheduled data pull → Colab Pro execution.
        
        Flow: Cron Schedule → Trigger Colab → Store Results
        """
        workflow = N8nWorkflow(name="Colab Job Scheduler")
        
        # 1. Cron trigger
        cron = N8nNode(
            id="cron_1",
            type="n8n-nodes-base.cron",
            position=(250, 300),
            name="Scheduled Trigger",
            parameters={
                "triggerTimes": {
                    "item": [{"mode": "custom", "cronExpression": schedule_cron}]
                }
            }
        )
        workflow.add_node(cron)
        
        # 2. Prepare job payload
        set_node = N8nNode(
            id="set_1",
            type="n8n-nodes-base.set",
            position=(450, 300),
            name="Prepare Job",
            parameters={
                "values": {
                    "string": [
                        {"name": "job_id", "value": "={{ $now.toFormat('yyyyMMdd-HHmmss') }}"},
                        {"name": "notebook_url", "value": colab_notebook_url},
                    ]
                }
            }
        )
        workflow.add_node(set_node)
        workflow.connect("cron_1", "set_1")
        
        # 3. Trigger Colab via Google Cloud Run
        colab_trigger = N8nNode(
            id="http_colab",
            type="n8n-nodes-base.httpRequest",
            position=(650, 300),
            name="Trigger Colab Job",
            parameters={
                "method": "POST",
                "url": "https://colab.research.google.com/api/v1/execute",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "notebook", "value": "={{ $json.notebook_url }}"},
                        {"name": "job_id", "value": "={{ $json.job_id }}"},
                    ]
                },
                "authentication": "genericCredentialType",
                "genericAuthType": "oAuth2Api",
            },
            credentials={"oAuth2Api": {"id": "google_oauth", "name": "Google OAuth2"}}
        )
        workflow.add_node(colab_trigger)
        workflow.connect("set_1", "http_colab")
        
        # 4. Store result reference
        store = N8nNode(
            id="http_store",
            type="n8n-nodes-base.httpRequest",
            position=(850, 300),
            name="Record Job Result",
            parameters={
                "method": "POST",
                "url": "http://localhost:8000/api/v1/jobs/results",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "job_id", "value": "={{ $json.job_id }}"},
                        {"name": "status", "value": "={{ $json.status }}"},
                        {"name": "output_path", "value": "={{ $json.output_path }}"},
                    ]
                },
                "options": {}
            }
        )
        workflow.add_node(store)
        workflow.connect("http_colab", "http_store")
        
        return workflow
    
    @staticmethod
    def incident_bundle_replay(
        api_endpoint: str = "http://localhost:8000"
    ) -> N8nWorkflow:
        """
        Template: Trigger incident bundle replay for testing.
        
        Flow: Manual Trigger → Fetch Bundle → Start Replay → Verify Hash
        """
        workflow = N8nWorkflow(name="Incident Bundle Replay")
        
        # 1. Manual trigger with bundle ID input
        trigger = N8nNode(
            id="manual_1",
            type="n8n-nodes-base.manualTrigger",
            position=(250, 300),
            name="Manual Trigger",
            parameters={}
        )
        workflow.add_node(trigger)
        
        # 2. Fetch bundle metadata
        fetch = N8nNode(
            id="http_fetch",
            type="n8n-nodes-base.httpRequest",
            position=(450, 300),
            name="Fetch Bundle",
            parameters={
                "method": "GET",
                "url": f"{api_endpoint}/api/v1/incidents/bundles/{{{{ $json.bundle_id }}}}",
                "options": {}
            }
        )
        workflow.add_node(fetch)
        workflow.connect("manual_1", "http_fetch")
        
        # 3. Start replay
        replay = N8nNode(
            id="http_replay",
            type="n8n-nodes-base.httpRequest",
            position=(650, 300),
            name="Start Replay",
            parameters={
                "method": "POST",
                "url": f"{api_endpoint}/api/v1/incidents/replay",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "bundle_id", "value": "={{ $json.id }}"},
                        {"name": "verify_hash", "value": "true"},
                    ]
                },
                "options": {}
            }
        )
        workflow.add_node(replay)
        workflow.connect("http_fetch", "http_replay")
        
        # 4. Verify hash match
        verify = N8nNode(
            id="if_verify",
            type="n8n-nodes-base.if",
            position=(850, 300),
            name="Hash Match?",
            parameters={
                "conditions": {
                    "boolean": [{
                        "value1": "={{ $json.hash_verified }}",
                        "operation": "equals",
                        "value2": True
                    }]
                }
            }
        )
        workflow.add_node(verify)
        workflow.connect("http_replay", "if_verify")
        
        # 5. Success/failure notifications
        success = N8nNode(
            id="success_1",
            type="n8n-nodes-base.noOp",
            position=(1050, 200),
            name="✓ Hash Verified",
            parameters={}
        )
        workflow.add_node(success)
        workflow.connect("if_verify", "success_1", source_output=0)
        
        failure = N8nNode(
            id="failure_1",
            type="n8n-nodes-base.stopAndError",
            position=(1050, 400),
            name="✗ Hash Mismatch",
            parameters={
                "errorMessage": "Bundle replay hash does not match!"
            }
        )
        workflow.add_node(failure)
        workflow.connect("if_verify", "failure_1", source_output=1)
        
        return workflow


def export_all_templates(output_dir: str = "n8n_workflows") -> Dict[str, str]:
    """
    Export all workflow templates to JSON files.
    
    Returns dict of filename -> hash for verification.
    """
    import os
    os.makedirs(output_dir, exist_ok=True)
    
    templates = {
        "alert_to_order": WorkflowTemplates.alert_to_order(),
        "regime_change": WorkflowTemplates.regime_change_handler(),
        "colab_scheduler": WorkflowTemplates.colab_job_scheduler(),
        "incident_replay": WorkflowTemplates.incident_bundle_replay(),
    }
    
    results = {}
    for name, workflow in templates.items():
        filename = f"{name}.json"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w') as f:
            f.write(workflow.to_json())
        
        results[filename] = workflow.get_hash()
        print(f"Exported: {filepath} (hash: {workflow.get_hash()})")
    
    return results


if __name__ == "__main__":
    # Generate all template workflows
    hashes = export_all_templates()
    print("\nWorkflow hashes for verification:")
    for name, hash_val in hashes.items():
        print(f"  {name}: {hash_val}")
