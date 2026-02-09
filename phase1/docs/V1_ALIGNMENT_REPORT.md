# Autopilot V1 Alignment Report

## Overview
This document identifies modules that violate V1 constraints, sources of nondeterminism, and what will be disabled/removed for V1 compliance.

---

## 1. Modules Violating V1 Constraints

### 1.1 Template Violations
| File | Issue | Status |
|------|-------|--------|
| `strategy_templates.py` | Contains `COVERED_CALL`, `IRON_CONDOR`, etc. | **Filtered** - V1 gate blocks non-V1 templates |
| `unified_engine.py` | Previously allowed all templates | **Fixed** - Enforces `V1_TEMPLATES` check |

**V1 Allowed Templates:** `LONG_CALL`, `LONG_PUT`

### 1.2 Risk Cap Violations
| Parameter | Issue | Resolution |
|-----------|-------|------------|
| `max_open_positions` | Was 5, needs 10 | **Fixed** - `V1_MAX_OPEN_POSITIONS = 10` |
| `max_total_exposure_usd` | Not enforced | **Fixed** - $1,000 cap |
| `per_position_stop_pct` | Was 20% | **Fixed** - 10% stop |

### 1.3 Exit Authority Violations
| Module | Issue | Resolution |
|--------|-------|------------|
| `exit_monitor.py` | Single authority | ✅ Compliant |
| `agents/*.py` | Could close independently | **Disabled** in V1 |

---

## 2. Sources of Nondeterminism

### 2.1 Random Fills
- Paper broker may use probabilistic fills
- **Resolution**: Implement deterministic fill rules

### 2.2 LLM Calls
- Uncached LLM responses in `llm_helpers.py`
- **Resolution**: Cache + temperature=0

### 2.3 Timestamps
- Uses `datetime.now()` in various places
- **Resolution**: Support frozen time in replay

---

## 3. Disabled in V1

- Short premium templates (IRON_CONDOR, etc.)
- Market orders
- Multi-agent parallel execution
- Probabilistic fills
- Risk limit overrides

---

## 4. V1 Contract

```python
V1_MAX_OPEN_POSITIONS = 10
V1_MAX_TOTAL_EXPOSURE_USD = 1000.0
V1_PER_POSITION_STOP_PCT = 0.10
V1_TEMPLATES = [LONG_CALL, LONG_PUT]
```

---

*Generated: 2026-01-25*
