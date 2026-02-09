"""
Unit tests for ticker_resolver.py

Tests cover:
- BRK variants (BRK.B, BRK-B, BRK/B, BRKB)
- Mixed case inputs
- Whitespace handling
- English collision tickers (A, I, ON, IT, ARE)
- Unknown tickers
- Empty/invalid inputs
"""

import pytest
from phase1.services.api.ticker_resolver import (
    resolve_ticker,
    resolve_ticker_batch,
    get_normalized_form,
    normalize_separator,
)


class TestNormalizeSeparator:
    def test_dash_to_dot(self):
        assert normalize_separator("BRK-B") == "BRK.B"
    
    def test_slash_to_dot(self):
        assert normalize_separator("BRK/B") == "BRK.B"
    
    def test_already_dot(self):
        assert normalize_separator("BRK.B") == "BRK.B"
    
    def test_no_separator(self):
        assert normalize_separator("AAPL") == "AAPL"
    
    def test_lowercase_input(self):
        assert normalize_separator("brk-b") == "BRK.B"


class TestResolveTickerBRK:
    """Test all BRK.B variants resolve to canonical BRK.B"""
    
    def test_brk_dot_b(self):
        result = resolve_ticker("BRK.B")
        assert result["ticker"] == "BRK.B"
        assert result["confidence"] == "high"
        assert not result["collision"]
    
    def test_brk_dash_b(self):
        result = resolve_ticker("BRK-B")
        assert result["ticker"] == "BRK.B"
        assert result["normalized"] == "BRK.B"
        assert result["confidence"] == "high"
    
    def test_brk_slash_b(self):
        result = resolve_ticker("BRK/B")
        assert result["ticker"] == "BRK.B"
        assert result["normalized"] == "BRK.B"
        assert result["confidence"] == "high"
    
    def test_brkb_no_separator(self):
        result = resolve_ticker("BRKB")
        assert result["ticker"] == "BRK.B"
        assert result["confidence"] == "high"
    
    def test_brk_b_lowercase(self):
        result = resolve_ticker("brk.b")
        assert result["ticker"] == "BRK.B"
        assert result["confidence"] == "high"
    
    def test_brk_b_mixed_case(self):
        result = resolve_ticker("BrK-b")
        assert result["ticker"] == "BRK.B"
        assert result["confidence"] == "high"


class TestResolveTickerMixedCase:
    def test_aapl_lowercase(self):
        result = resolve_ticker("aapl")
        assert result["ticker"] == "AAPL"
        assert result["confidence"] == "high"
    
    def test_aapl_uppercase(self):
        result = resolve_ticker("AAPL")
        assert result["ticker"] == "AAPL"
        assert result["confidence"] == "high"
    
    def test_aapl_mixed(self):
        result = resolve_ticker("AaPl")
        assert result["ticker"] == "AAPL"
        assert result["confidence"] == "high"


class TestResolveTickerWhitespace:
    def test_leading_whitespace(self):
        result = resolve_ticker("  AAPL")
        assert result["ticker"] == "AAPL"
        assert result["confidence"] == "high"
    
    def test_trailing_whitespace(self):
        result = resolve_ticker("AAPL  ")
        assert result["ticker"] == "AAPL"
        assert result["confidence"] == "high"
    
    def test_both_whitespace(self):
        result = resolve_ticker("  AAPL  ")
        assert result["ticker"] == "AAPL"
        assert result["confidence"] == "high"


class TestResolveTickerCollisions:
    """Test English word collision tickers return low confidence"""
    
    def test_ticker_a_collision(self):
        result = resolve_ticker("A")
        assert result["ticker"] == "A"
        assert result["confidence"] == "low"
        assert result["collision"] is True
        assert "collision" in result["reason"].lower()
    
    def test_ticker_i_collision(self):
        result = resolve_ticker("I")
        assert result["ticker"] == "I"
        assert result["confidence"] == "low"
        assert result["collision"] is True
    
    def test_ticker_on_collision(self):
        result = resolve_ticker("ON")
        assert result["ticker"] == "ON"
        assert result["confidence"] == "low"
        assert result["collision"] is True
    
    def test_ticker_it_collision(self):
        result = resolve_ticker("IT")
        assert result["ticker"] == "IT"
        assert result["confidence"] == "low"
        assert result["collision"] is True
    
    def test_ticker_are_collision(self):
        result = resolve_ticker("ARE")
        assert result["ticker"] == "ARE"
        assert result["confidence"] == "low"
        assert result["collision"] is True


class TestResolveTickerUnknown:
    def test_unknown_ticker(self):
        result = resolve_ticker("FAKESYMBOL")
        assert result["ticker"] == "FAKESYMBOL"
        assert result["confidence"] == "low"
        assert "unknown" in result["reason"].lower()
        assert not result["collision"]
    
    def test_unknown_ticker_with_separator(self):
        result = resolve_ticker("FAKE-A")
        assert result["ticker"] == "FAKE.A"  # Normalized
        assert result["confidence"] == "low"


class TestResolveTickerInvalid:
    def test_empty_string(self):
        result = resolve_ticker("")
        assert result["ticker"] == ""
        assert result["confidence"] == "low"
        assert "empty" in result["reason"].lower()
    
    def test_only_whitespace(self):
        result = resolve_ticker("   ")
        assert result["ticker"] == ""
        assert result["confidence"] == "low"


class TestResolveTickerCompanyNames:
    def test_aapl_has_company(self):
        result = resolve_ticker("AAPL")
        assert result["company"] == "Apple Inc."
    
    def test_brk_b_has_company(self):
        result = resolve_ticker("BRK-B")
        assert result["company"] == "Berkshire Hathaway Inc. (Class B)"
    
    def test_unknown_no_company(self):
        result = resolve_ticker("FAKESYMBOL")
        assert result["company"] is None


class TestResolveTickerBatch:
    def test_batch_multiple_tickers(self):
        inputs = ["AAPL", "brk-b", "  MSFT  ", "A", "FAKESYMBOL"]
        results = resolve_ticker_batch(inputs)
        
        assert len(results) == 5
        assert results[0]["ticker"] == "AAPL"
        assert results[0]["confidence"] == "high"
        
        assert results[1]["ticker"] == "BRK.B"
        assert results[1]["confidence"] == "high"
        
        assert results[2]["ticker"] == "MSFT"
        assert results[2]["confidence"] == "high"
        
        assert results[3]["ticker"] == "A"
        assert results[3]["confidence"] == "low"  # Collision
        
        assert results[4]["ticker"] == "FAKESYMBOL"
        assert results[4]["confidence"] == "low"  # Unknown


class TestGetNormalizedForm:
    def test_get_normalized_brk(self):
        assert get_normalized_form("BRK-B") == "BRK.B"
    
    def test_get_normalized_aapl(self):
        assert get_normalized_form("aapl") == "AAPL"
    
    def test_get_normalized_unknown(self):
        assert get_normalized_form("FAKE") == "FAKE"
