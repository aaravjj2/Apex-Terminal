"""
Unit tests for Fundamentals Adapter
"""
import pytest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from unittest.mock import Mock, MagicMock
from services.fundamentals.adapter import FundamentalsAdapter


@pytest.fixture
def mock_yf():
    """Create a mock yfinance module"""
    mock = MagicMock()
    return mock


@pytest.fixture
def adapter(mock_yf):
    """Create adapter with mocked yfinance"""
    adapter = FundamentalsAdapter()
    adapter._yf = mock_yf
    return adapter


class TestFundamentalsAdapter:
    def test_get_fundamentals_success(self, adapter, mock_yf):
        """Test successful fundamentals fetch"""
        # Mock yfinance Ticker object
        mock_info = {
            'returnOnEquity': 0.25,
            'returnOnAssets': 0.15,
            'grossMargins': 0.40,
            'operatingMargins': 0.30,
            'profitMargins': 0.20,
            'freeCashflow': 50000000000,
            'debtToEquity': 1.5,
            'currentRatio': 2.0,
            'quickRatio': 1.5,
            'trailingPE': 25.0,
            'priceToBook': 5.0,
            'priceToSalesTrailing12Months': 3.0,
            'marketCap': 2000000000000,
            'enterpriseValue': 2100000000000,
            'sharesOutstanding': 16000000000,
            'revenueGrowth': 0.15,
            'earningsGrowth': 0.20,
        }
        
        mock_ticker_instance = Mock()
        mock_ticker_instance.info = mock_info
        mock_yf.Ticker.return_value = mock_ticker_instance
        
        result = adapter.get_fundamentals("AAPL")
        
        assert result is not None
        assert result.symbol == "AAPL"
        assert result.roic == 0.25
        assert result.gross_margin == 0.40
        assert result.operating_margin == 0.30
        assert result.fcf == 50000000000
        assert result.market_cap == 2000000000000

    def test_profitability_metrics(self, adapter, mock_yf):
        """Test profitability metrics extraction"""
        mock_info = {
            'returnOnEquity': 0.25,
            'grossMargins': 0.40,
            'operatingMargins': 0.30,
            'profitMargins': 0.20,
            'marketCap': 1000000000,
        }
        
        mock_ticker_instance = Mock()
        mock_ticker_instance.info = mock_info
        mock_yf.Ticker.return_value = mock_ticker_instance
        
        result = adapter.get_fundamentals("AAPL")
        
        assert result.roic == 0.25  # Using ROE as proxy
        assert result.gross_margin == 0.40
        assert result.operating_margin == 0.30

    def test_missing_data_handling(self, adapter, mock_yf):
        """Test handling of missing data"""
        # Mock with minimal data
        mock_info = {
            'symbol': 'TEST',
            # Most fields missing
        }
        
        mock_ticker_instance = Mock()
        mock_ticker_instance.info = mock_info
        mock_yf.Ticker.return_value = mock_ticker_instance
        
        result = adapter.get_fundamentals("TEST")
        
        assert result is not None
        # Missing fields should be None
        assert result.roic is None
        assert result.fcf is None
        assert result.gross_margin is None

    def test_fcf_yield_calculation(self, adapter, mock_yf):
        """Test FCF yield calculation"""
        mock_info = {
            'freeCashflow': 100000000000,
            'marketCap': 2000000000000,
        }
        
        mock_ticker_instance = Mock()
        mock_ticker_instance.info = mock_info
        mock_yf.Ticker.return_value = mock_ticker_instance
        
        result = adapter.get_fundamentals("AAPL")
        
        assert result.fcf == 100000000000
        # FCF yield = (FCF / Market Cap) * 100 = 5%
        assert result.fcf_yield is not None
        assert abs(result.fcf_yield - 5.0) < 0.001

    def test_roic_from_roe(self, adapter, mock_yf):
        """Test ROIC extraction (using ROE as proxy)"""
        mock_info = {
            'returnOnEquity': 0.30,
            'debtToEquity': 0.5,
            'marketCap': 1000000000,
        }
        
        mock_ticker_instance = Mock()
        mock_ticker_instance.info = mock_info
        mock_yf.Ticker.return_value = mock_ticker_instance
        
        result = adapter.get_fundamentals("AAPL")
        
        # Should use ROE as proxy for ROIC
        assert result.roic == 0.30

    def test_valuation_ratios(self, adapter, mock_yf):
        """Test valuation ratio extraction"""
        mock_info = {
            'trailingPE': 25.5,
            'priceToBook': 10.2,
            'priceToSalesTrailing12Months': 7.8,
            'marketCap': 1000000000,
        }
        
        mock_ticker_instance = Mock()
        mock_ticker_instance.info = mock_info
        mock_yf.Ticker.return_value = mock_ticker_instance
        
        result = adapter.get_fundamentals("AAPL")
        
        assert result.pe_ratio == 25.5
        assert result.pb_ratio == 10.2

    def test_growth_metrics(self, adapter, mock_yf):
        """Test growth metrics extraction"""
        mock_info = {
            'revenueGrowth': 0.15,
            'earningsGrowth': 0.22,
            'marketCap': 1000000000,
        }
        
        mock_ticker_instance = Mock()
        mock_ticker_instance.info = mock_info
        mock_yf.Ticker.return_value = mock_ticker_instance
        
        result = adapter.get_fundamentals("AAPL")
        
        assert result.revenue_growth == 0.15
        assert result.earnings_growth == 0.22

    def test_ticker_fetch_error(self, adapter, mock_yf):
        """Test error handling when yfinance fails"""
        mock_yf.Ticker.side_effect = Exception("Network error")
        
        result = adapter.get_fundamentals("INVALID")
        
        # Should return None on error
        assert result is None

    def test_timestamp_included(self, adapter, mock_yf):
        """Test that timestamp is included in result"""
        mock_info = {'symbol': 'TEST', 'marketCap': 1000000000}
        
        mock_ticker_instance = Mock()
        mock_ticker_instance.info = mock_info
        mock_yf.Ticker.return_value = mock_ticker_instance
        
        result = adapter.get_fundamentals("TEST")
        
        assert result is not None
        assert result.timestamp is not None
        assert result.provider == "yfinance"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
