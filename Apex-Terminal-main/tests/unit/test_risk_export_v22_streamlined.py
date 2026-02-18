"""
Risk Desk Export Bundle Tests (v1.22) - Streamlined version

Tests portfolio artifacts in export bundles using direct function calls.
"""

import pytest
import json
import hashlib
import zipfile
import io
from datetime import datetime, timezone

from phase1.services.risk_desk.schemas_w2 import (
    RiskRunResult, 
    StressResult, 
    GreeksSummary, 
    ComplianceResult, 
    StressScenario
)
from phase1.services.api.routes import risk_desk as risk_desk_module
from phase1.services.portfolio import reset_demo_store, create_demo_fixtures


@pytest.fixture(autouse=True)
def setup_demo_store():
    """Setup demo portfolio fixtures and clean run store."""
    reset_demo_store()
    from phase1.services.portfolio import get_demo_store
    store = get_demo_store()
    store.seed_fixtures(create_demo_fixtures())
    risk_desk_module._run_store.clear()
    yield
    risk_desk_module._run_store.clear()
    reset_demo_store()


def create_test_run():
    """Helper to create test run."""
    return RiskRunResult(
        run_id="TEST-RUN-001",
        ok=True,
        config_hash="test_config_hash_12345",
        portfolio_hash="test_portfolio_hash_67890",
        created_at=datetime(2024, 1, 15, 16, 0, 0, tzinfo=timezone.utc).isoformat(),
        greeks=GreeksSummary(net_delta=100.0, net_gamma=5.0, net_vega=50.0, net_theta=-10.0, net_rho=2.0),
        stress=StressResult(
            scenario=StressScenario(id="moderate_selloff", label="Moderate Sell-off", spot_shift_pct=-10.0, vol_shift_pct=20.0),
            total_pnl=-5000.0, hedge_candidates=[]
        ),
        compliance=ComplianceResult(status="approved", violations=[]),
        tool_trace=[]
    )


@pytest.mark.asyncio
async def test_export_includes_portfolio_artifacts():
    """Test that export bundle includes portfolio.json and valuation_inputs.json."""
    run = create_test_run()
    risk_desk_module._run_store[run.run_id] = run
    
    # Call export function directly
    response = await risk_desk_module.export_risk_run(run_id=run.run_id, portfolio_id="DEMO-PORT-001")
    
    # Parse ZIP
    zip_buffer = io.BytesIO(response.body)
    with zipfile.ZipFile(zip_buffer, 'r') as zipf:
        namelist = zipf.namelist()
        
        # Assert portfolio artifacts exist
        assert f"{run.run_id}/portfolio/portfolio.json" in namelist
        assert f"{run.run_id}/portfolio/valuation_inputs.json" in namelist
        assert f"{run.run_id}/MANIFEST.json" in namelist
        
        # Read portfolio.json
        portfolio_data = json.loads(zipf.read(f"{run.run_id}/portfolio/portfolio.json"))
        assert portfolio_data["portfolio_id"] == "DEMO-PORT-001"
        assert "name" in portfolio_data
        assert "positions" in portfolio_data
        
        # Read valuation_inputs.json
        valuation_data = json.loads(zipf.read(f"{run.run_id}/portfolio/valuation_inputs.json"))
        assert valuation_data["pricing_source"] == "demo-bars:last-close"
        assert "source_checksum" in valuation_data
        assert valuation_data["rounding_policy"] == "0.01"


@pytest.mark.asyncio
async def test_manifest_has_checksums():
    """Test that MANIFEST.json includes portfolio artifacts with SHA256 checksums."""
    run = create_test_run()
    risk_desk_module._run_store[run.run_id] = run
    
    response = await risk_desk_module.export_risk_run(run_id=run.run_id, portfolio_id="DEMO-PORT-001")
    
    zip_buffer = io.BytesIO(response.body)
    with zipfile.ZipFile(zip_buffer, 'r') as zipf:
        manifest_data = json.loads(zipf.read(f"{run.run_id}/MANIFEST.json"))
        
        # Assert manifest contains portfolio artifacts
        portfolio_key = f"{run.run_id}/portfolio/portfolio.json"
        valuation_key = f"{run.run_id}/portfolio/valuation_inputs.json"
        
        assert portfolio_key in manifest_data
        assert valuation_key in manifest_data
        
        # Assert checksums are valid SHA256 (64 hex chars)
        assert len(manifest_data[portfolio_key]) == 64
        assert all(c in '0123456789abcdef' for c in manifest_data[portfolio_key])


@pytest.mark.asyncio
async def test_manifest_checksums_match_content():
    """Test that manifest checksums match actual file content SHA256."""
    run = create_test_run()
    risk_desk_module._run_store[run.run_id] = run
    
    response = await risk_desk_module.export_risk_run(run_id=run.run_id, portfolio_id="DEMO-PORT-001")
    
    zip_buffer = io.BytesIO(response.body)
    with zipfile.ZipFile(zip_buffer, 'r') as zipf:
        manifest_data = json.loads(zipf.read(f"{run.run_id}/MANIFEST.json"))
        
        # Verify portfolio.json checksum
        portfolio_key = f"{run.run_id}/portfolio/portfolio.json"
        portfolio_content = zipf.read(portfolio_key)
        computed_hash = hashlib.sha256(portfolio_content).hexdigest()
        assert manifest_data[portfolio_key] == computed_hash
        
        # Verify valuation_inputs.json checksum
        valuation_key = f"{run.run_id}/portfolio/valuation_inputs.json"
        valuation_content = zipf.read(valuation_key)
        computed_hash = hashlib.sha256(valuation_content).hexdigest()
        assert manifest_data[valuation_key] == computed_hash


@pytest.mark.asyncio
async def test_manifest_stable_ordering():
    """Test that manifest file paths are lexicographically sorted."""
    run = create_test_run()
    risk_desk_module._run_store[run.run_id] = run
    
    response = await risk_desk_module.export_risk_run(run_id=run.run_id, portfolio_id="DEMO-PORT-001")
    
    zip_buffer = io.BytesIO(response.body)
    with zipfile.ZipFile(zip_buffer, 'r') as zipf:
        manifest_content = zipf.read(f"{run.run_id}/MANIFEST.json").decode('utf-8')
        manifest_data = json.loads(manifest_content)
        
        # Extract keys in order
        keys = list(manifest_data.keys())
        sorted_keys = sorted(keys)
        
        # Verify keys are sorted
        assert keys == sorted_keys, f"Manifest keys not sorted"


@pytest.mark.asyncio
async def test_export_determinism_manifest_hash():
    """Test that generating the same export twice produces identical manifest hash."""
    run = create_test_run()
    risk_desk_module._run_store[run.run_id] = run
    
    # Generate export twice
    response1 = await risk_desk_module.export_risk_run(run_id=run.run_id, portfolio_id="DEMO-PORT-001")
    response2 = await risk_desk_module.export_risk_run(run_id=run.run_id, portfolio_id="DEMO-PORT-001")
    
    # Extract manifests
    zip1 = io.BytesIO(response1.body)
    zip2 = io.BytesIO(response2.body)
    
    with zipfile.ZipFile(zip1, 'r') as zipf1, zipfile.ZipFile(zip2, 'r') as zipf2:
        manifest1_content = zipf1.read(f"{run.run_id}/MANIFEST.json")
        manifest2_content = zipf2.read(f"{run.run_id}/MANIFEST.json")
        
        # Compute SHA256
        hash1 = hashlib.sha256(manifest1_content).hexdigest()
        hash2 = hashlib.sha256(manifest2_content).hexdigest()
        
        # Must be identical
        assert hash1 == hash2
        
        # Save determinism evidence
        with open("artifacts/proof/v1-21-22/determinism/export_manifest_run1.json", "w") as f:
            f.write(manifest1_content.decode('utf-8'))
        with open("artifacts/proof/v1-21-22/determinism/export_manifest_run2.json", "w") as f:
            f.write(manifest2_content.decode('utf-8'))
        with open("artifacts/proof/v1-21-22/determinism/export_manifest_run1.sha256", "w") as f:
            f.write(hash1)
        with open("artifacts/proof/v1-21-22/determinism/export_manifest_run2.sha256", "w") as f:
            f.write(hash2)
        with open("artifacts/proof/v1-21-22/determinism/assertion.txt", "w") as f:
            f.write(f"Export manifest determinism: match={hash1 == hash2}\n")
            f.write(f"Run 1 hash: {hash1}\n")
            f.write(f"Run 2 hash: {hash2}\n")


@pytest.mark.asyncio
async def test_export_readme_updated():
    """Test that README.txt includes v1.22 portfolio artifacts documentation."""
    run = create_test_run()
    risk_desk_module._run_store[run.run_id] = run
    
    response = await risk_desk_module.export_risk_run(run_id=run.run_id, portfolio_id="DEMO-PORT-001")
    
    zip_buffer = io.BytesIO(response.body)
    with zipfile.ZipFile(zip_buffer, 'r') as zipf:
        readme_content = zipf.read(f"{run.run_id}/README.txt").decode('utf-8')
        
        # Assert v1.22 portfolio artifacts documented
        assert "portfolio/portfolio.json" in readme_content
        assert "portfolio/valuation_inputs.json" in readme_content
        assert "MANIFEST.json" in readme_content
        assert "Attached Portfolio:" in readme_content


@pytest.mark.asyncio
async def test_export_default_portfolio_deterministic():
    """Test that export uses deterministic default when portfolio_id omitted."""
    run = create_test_run()
    risk_desk_module._run_store[run.run_id] = run
    
    # Call without portfolio_id (uses default)
    response = await risk_desk_module.export_risk_run(run_id=run.run_id)
    
    zip_buffer = io.BytesIO(response.body)
    with zipfile.ZipFile(zip_buffer, 'r') as zipf:
        portfolio_data = json.loads(zipf.read(f"{run.run_id}/portfolio/portfolio.json"))
        # Must use deterministic default
        assert portfolio_data["portfolio_id"] == "DEMO-PORT-001"
