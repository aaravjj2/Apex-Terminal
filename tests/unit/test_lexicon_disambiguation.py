"""
Unit tests for Finance Lexicon Disambiguation (Objective H, v1.12).

Tests the classify_token function for deterministic TICKER | WORD | AMBIGUOUS | INVALID classification.
"""

import pytest
from phase1.services.api.ticker_resolver import classify_token, classify_tokens_batch


class TestTokenClassification:
    """Test token classification for lexicon disambiguation."""
    
    def test_classify_ticker_unambiguous(self):
        """Unambiguous ticker should return TICKER classification."""
        result = classify_token("AAPL")
        assert result["classification"] == "TICKER"
        assert result["ticker"] == "AAPL"
        assert result["confidence"] == "high"
        assert result["disambiguation_needed"] is False
        assert result["company"] == "Apple Inc."
    
    def test_classify_ticker_lowercase(self):
        """Lowercase ticker should normalize and return TICKER."""
        result = classify_token("msft")
        assert result["classification"] == "TICKER"
        assert result["ticker"] == "MSFT"
        assert result["confidence"] == "high"
        assert result["disambiguation_needed"] is False
    
    def test_classify_ticker_with_separator(self):
        """Ticker with separator should normalize and return TICKER."""
        result = classify_token("BRK-B")
        assert result["classification"] == "TICKER"
        assert result["ticker"] == "BRK.B"
        assert result["confidence"] == "high"
        assert result["disambiguation_needed"] is False
        assert result["company"] == "Berkshire Hathaway Inc. (Class B)"
    
    def test_classify_ambiguous_collision_a(self):
        """Collision ticker 'A' should return AMBIGUOUS."""
        result = classify_token("A")
        assert result["classification"] == "AMBIGUOUS"
        assert result["ticker"] == "A"
        assert result["confidence"] == "low"
        assert result["disambiguation_needed"] is True
        assert "English word" in result["reason"]
    
    def test_classify_ambiguous_collision_i(self):
        """Collision ticker 'I' should return AMBIGUOUS."""
        result = classify_token("I")
        assert result["classification"] == "AMBIGUOUS"
        assert result["ticker"] == "I"
        assert result["disambiguation_needed"] is True
    
    def test_classify_ambiguous_collision_on(self):
        """Collision ticker 'ON' should return AMBIGUOUS."""
        result = classify_token("ON")
        assert result["classification"] == "AMBIGUOUS"
        assert result["ticker"] == "ON"
        assert result["disambiguation_needed"] is True
        assert result["company"] == "ON Semiconductor Corporation"
    
    def test_classify_ambiguous_collision_it(self):
        """Collision ticker 'IT' should return AMBIGUOUS."""
        result = classify_token("IT")
        assert result["classification"] == "AMBIGUOUS"
        assert result["ticker"] == "IT"
        assert result["disambiguation_needed"] is True
    
    def test_classify_ambiguous_collision_are(self):
        """Collision ticker 'ARE' should return AMBIGUOUS."""
        result = classify_token("ARE")
        assert result["classification"] == "AMBIGUOUS"
        assert result["ticker"] == "ARE"
        assert result["disambiguation_needed"] is True


    def test_classify_word_unknown_ticker(self):
        """Unknown token not in lexicon should return WORD."""
        result = classify_token("HELLO")
        assert result["classification"] == "WORD"
        assert result["ticker"] is None
        assert result["confidence"] == "none"
        assert result["disambiguation_needed"] is False
        assert "not found in ticker lexicon" in result["reason"]
    
    def test_classify_word_english_word(self):
        """English word not in lexicon should return WORD."""
        result = classify_token("quick")
        assert result["classification"] == "WORD"
        assert result["ticker"] is None
        assert result["disambiguation_needed"] is False
    
    def test_classify_invalid_empty(self):
        """Empty string should return INVALID."""
        result = classify_token("")
        assert result["classification"] == "INVALID"
        assert result["ticker"] is None
        assert result["confidence"] == "none"
        assert result["disambiguation_needed"] is False
        assert "Empty input" in result["reason"]
    
    def test_classify_invalid_whitespace_only(self):
        """Whitespace-only string should return INVALID."""
        result = classify_token("   ")
        assert result["classification"] == "INVALID"
        assert result["ticker"] is None
        assert result["disambiguation_needed"] is False
    
    def test_classify_invalid_special_chars_only(self):
        """Special characters only should return INVALID."""
        result = classify_token("@#$%")
        assert result["classification"] == "INVALID"
        assert result["ticker"] is None
        assert result["disambiguation_needed"] is False
        assert "No alphanumeric characters" in result["reason"]
    
    def test_classify_determinism(self):
        """Classification should be deterministic (same input -> same output)."""
        input_token = "AAPL"
        result1 = classify_token(input_token)
        result2 = classify_token(input_token)
        assert result1 == result2
        
        ambiguous_token = "ON"
        result3 = classify_token(ambiguous_token)
        result4 = classify_token(ambiguous_token)
        assert result3 == result4
    
    def test_classify_tokens_batch(self):
        """Batch classification should work correctly."""
        tokens = ["AAPL", "A", "HELLO", "", "BRK-B"]
        results = classify_tokens_batch(tokens)
        
        assert len(results) == 5
        assert results[0]["classification"] == "TICKER"      # AAPL
        assert results[1]["classification"] == "AMBIGUOUS"   # A
        assert results[2]["classification"] == "WORD"        # HELLO
        assert results[3]["classification"] == "INVALID"     # empty
        assert results[4]["classification"] == "TICKER"      # BRK-B
    
    def test_classify_mixed_case_ambiguous(self):
        """Mixed case ambiguous token should still be AMBIGUOUS."""
        result = classify_token("oN")
        assert result["classification"] == "AMBIGUOUS"
        assert result["ticker"] == "ON"
    
    def test_classify_with_whitespace(self):
        """Tokens with leading/trailing whitespace should be trimmed."""
        result = classify_token("  MSFT  ")
        assert result["classification"] == "TICKER"
        assert result["ticker"] == "MSFT"


class TestDisambiguationNeededFlag:
    """Test the disambiguation_needed flag specifically."""
    
    def test_disambiguation_not_needed_for_ticker(self):
        """Regular tickers don't need disambiguation."""
        result = classify_token("AAPL")
        assert result["disambiguation_needed"] is False
    
    def test_disambiguation_not_needed_for_word(self):
        """Words don't need disambiguation."""
        result = classify_token("TESTING")
        assert result["disambiguation_needed"] is False
    
    def test_disambiguation_not_needed_for_invalid(self):
        """Invalid inputs don't need disambiguation."""
        result = classify_token("")
        assert result["disambiguation_needed"] is False
    
    def test_disambiguation_needed_for_ambiguous(self):
        """Ambiguous tokens require disambiguation."""
        for token in ["A", "I", "ON", "IT", "ARE"]:
            result = classify_token(token)
            assert result["disambiguation_needed"] is True, f"Token {token} should need disambiguation"
