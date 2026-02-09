"""
Unit tests for services.risk_desk — Week 1 validator.

Tests cover:
- Happy path (valid demo portfolio)
- Missing columns
- Empty portfolio
- Invalid option_type
- Invalid expiry format
- Missing strike
- Negative multiplier / non-standard multiplier
- Side/quantity contradiction
- Ticker normalization (BRK.B → BRK-B)
- Strike not found in snapshot warning
"""

import pytest
from pathlib import Path

from services.risk_desk.schemas import Severity, Snapshot, SnapshotEntry
from services.risk_desk.validator import (
    validate_portfolio,
    parse_csv,
    normalize_ticker,
    load_default_snapshot,
)

FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent / "services" / "risk_desk" / "fixtures"

# ── helpers ─────────────────────────────────────────────────────────────────

VALID_CSV = (FIXTURES_DIR / "demo_portfolio.csv").read_text()


MINIMAL_VALID = """\
symbol,option_type,strike,expiry,quantity,side,multiplier
AAPL,call,220,2025-03-21,10,buy,100
"""


# ── tests ───────────────────────────────────────────────────────────────────

class TestNormalizeTicker:
    def test_brk_dot(self):
        norm, aliased = normalize_ticker("BRK.B")
        assert norm == "BRK-B"
        assert aliased is True

    def test_no_alias(self):
        norm, aliased = normalize_ticker("AAPL")
        assert norm == "AAPL"
        assert aliased is False


class TestParseCSV:
    def test_parses_demo(self):
        p = parse_csv(VALID_CSV)
        assert len(p.rows) == 7
        assert "symbol" in p.column_names

    def test_empty(self):
        p = parse_csv("symbol,option_type,strike,expiry,quantity,side\n")
        assert len(p.rows) == 0


class TestValidatePortfolio:
    def test_happy_path_demo(self):
        """The committed demo_portfolio.csv should be valid (0 errors)."""
        result = validate_portfolio(VALID_CSV)
        assert result.valid is True
        assert result.error_count == 0
        # BRK.B normalization should produce a warning
        assert result.warning_count >= 1
        codes = [i.code for i in result.issues]
        assert "TICKER_NORMALIZED" in codes

    def test_minimal_valid(self):
        result = validate_portfolio(MINIMAL_VALID)
        assert result.valid is True
        assert result.error_count == 0

    def test_missing_column(self):
        csv_text = "symbol,option_type,strike\nAAPL,call,220\n"
        result = validate_portfolio(csv_text)
        assert result.valid is False
        codes = [i.code for i in result.issues]
        assert "MISSING_COLUMN" in codes

    def test_empty_portfolio(self):
        csv_text = ""
        result = validate_portfolio(csv_text)
        assert result.valid is False
        codes = [i.code for i in result.issues]
        assert "EMPTY_PORTFOLIO" in codes

    def test_invalid_option_type(self):
        csv_text = "symbol,option_type,strike,expiry,quantity,side,multiplier\nAAPL,straddle,220,2025-03-21,10,buy,100\n"
        result = validate_portfolio(csv_text)
        assert result.valid is False
        codes = [i.code for i in result.issues]
        assert "INVALID_OPTION_TYPE" in codes

    def test_bad_expiry_format(self):
        csv_text = "symbol,option_type,strike,expiry,quantity,side,multiplier\nAAPL,call,220,03/21/2025,10,buy,100\n"
        result = validate_portfolio(csv_text)
        assert result.valid is False
        codes = [i.code for i in result.issues]
        assert "INVALID_EXPIRY_FORMAT" in codes

    def test_missing_strike(self):
        csv_text = "symbol,option_type,strike,expiry,quantity,side,multiplier\nAAPL,call,,2025-03-21,10,buy,100\n"
        result = validate_portfolio(csv_text)
        assert result.valid is False
        codes = [i.code for i in result.issues]
        assert "MISSING_STRIKE" in codes

    def test_negative_multiplier(self):
        csv_text = "symbol,option_type,strike,expiry,quantity,side,multiplier\nAAPL,call,220,2025-03-21,10,buy,-50\n"
        result = validate_portfolio(csv_text)
        assert result.valid is False
        codes = [i.code for i in result.issues]
        assert "INVALID_MULTIPLIER" in codes

    def test_nonstandard_multiplier_warning(self):
        csv_text = "symbol,option_type,strike,expiry,quantity,side,multiplier\nAAPL,call,220,2025-03-21,10,buy,10\n"
        result = validate_portfolio(csv_text)
        # non-standard multiplier is a warning, not an error
        assert result.valid is True
        codes = [i.code for i in result.issues]
        assert "NONSTANDARD_MULTIPLIER" in codes

    def test_side_qty_contradiction_buy_negative(self):
        csv_text = "symbol,option_type,strike,expiry,quantity,side,multiplier\nAAPL,call,220,2025-03-21,-5,buy,100\n"
        result = validate_portfolio(csv_text)
        assert result.valid is False
        codes = [i.code for i in result.issues]
        assert "SIDE_QTY_CONTRADICTION" in codes

    def test_side_qty_contradiction_sell_positive(self):
        csv_text = "symbol,option_type,strike,expiry,quantity,side,multiplier\nAAPL,call,220,2025-03-21,5,sell,100\n"
        result = validate_portfolio(csv_text)
        assert result.valid is False
        codes = [i.code for i in result.issues]
        assert "SIDE_QTY_CONTRADICTION" in codes

    def test_strike_not_in_snapshot(self):
        """Strike 999 doesn't exist in snapshot → warning."""
        csv_text = "symbol,option_type,strike,expiry,quantity,side,multiplier\nAAPL,call,999,2025-03-21,10,buy,100\n"
        result = validate_portfolio(csv_text)
        # This is a warning, not an error
        assert result.valid is True
        codes = [i.code for i in result.issues]
        assert "STRIKE_NOT_IN_SNAPSHOT" in codes

    def test_ticker_normalization_brk(self):
        csv_text = "symbol,option_type,strike,expiry,quantity,side,multiplier\nBRK.B,call,420,2025-06-20,1,buy,100\n"
        result = validate_portfolio(csv_text)
        codes = [i.code for i in result.issues]
        assert "TICKER_NORMALIZED" in codes

    def test_invalid_side(self):
        csv_text = "symbol,option_type,strike,expiry,quantity,side,multiplier\nAAPL,call,220,2025-03-21,10,hold,100\n"
        result = validate_portfolio(csv_text)
        assert result.valid is False
        codes = [i.code for i in result.issues]
        assert "INVALID_SIDE" in codes


class TestLoadSnapshot:
    def test_loads_fixture(self):
        snap = load_default_snapshot()
        assert len(snap.entries) > 0
        assert snap.entries[0].symbol
