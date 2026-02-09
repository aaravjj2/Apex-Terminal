"""
Unit tests for Configuration Management

These tests ensure:
1. PROFILE=prod mode disables keys.env file loading
2. Secrets are loaded from environment variables only in production
3. CI guard to prevent secrets from leaking to public repos
"""
import os
import pytest
from unittest.mock import patch, MagicMock


class TestConfigSecrets:
    """Tests for secrets management and CI guards."""
    
    def test_production_mode_skips_file_loading(self):
        """CRITICAL: PROFILE=prod must skip keys.env loading."""
        # Clear cached settings
        from services import config
        config.get_settings.cache_clear()
        
        with patch.dict(os.environ, {"PROFILE": "prod"}, clear=False):
            # Reimport to pick up the PROFILE change
            import importlib
            importlib.reload(config)
            
            # Verify IS_PRODUCTION flag
            assert config.IS_PRODUCTION is True
            
            # Mock dotenv.load_dotenv to verify it's NOT called
            with patch("dotenv.load_dotenv") as mock_load:
                config._load_keys_env_if_dev()
                mock_load.assert_not_called()
        
        # Reset module state
        importlib.reload(config)
    
    def test_dev_mode_loads_keys_env(self):
        """In dev mode (default), keys.env should be loaded if present."""
        from services import config
        config.get_settings.cache_clear()
        
        with patch.dict(os.environ, {"PROFILE": "dev"}, clear=False):
            import importlib
            importlib.reload(config)
            
            assert config.IS_PRODUCTION is False
        
        # Reset module state
        importlib.reload(config)
    
    def test_ci_guard_no_hardcoded_secrets(self):
        """
        CI GUARD: Verify no hardcoded secrets in config.py
        
        This test runs in CI to ensure the public repo doesn't contain secrets.
        """
        import inspect
        from services import config
        
        source = inspect.getsource(config)
        
        # List of patterns that should NEVER appear in config.py
        forbidden_patterns = [
            "sk-",           # OpenAI keys
            "PK",            # Alpaca live keys start with PK
            "AK",            # Alpaca live keys
            "AKID",          # AWS keys
            "ghp_",          # GitHub tokens
            "gho_",          # GitHub OAuth
            "api_key=",      # Inline API keys
        ]
        
        for pattern in forbidden_patterns:
            assert pattern not in source, f"SECURITY: Found forbidden pattern '{pattern}' in config.py"
    
    def test_keys_env_example_has_placeholders(self):
        """Verify keys.env.example contains only placeholders, not real keys."""
        example_path = os.path.join(
            os.path.dirname(__file__),
            "..", "..",
            "keys.env.example"
        )
        
        if os.path.exists(example_path):
            with open(example_path) as f:
                content = f.read()
            
            # Check for placeholder patterns
            assert "your_" in content or "YOUR_" in content or "xxx" in content.lower() or "<" in content, \
                "keys.env.example should contain placeholder values like 'your_api_key_here'"
    
    def test_settings_loads_alpaca_from_env(self):
        """Test that Alpaca credentials load from environment variables."""
        from services import config
        config.get_settings.cache_clear()
        
        test_key = "test_alpaca_key_123"
        test_secret = "test_alpaca_secret_456"
        test_endpoint = "https://test.alpaca.markets"
        
        with patch.dict(os.environ, {
            "ALPACA3_KEY": test_key,
            "ALPACA3_SECRET": test_secret,
            "ALPACA3_ENDPOINT": test_endpoint,
            "PROFILE": "prod",
        }, clear=False):
            import importlib
            importlib.reload(config)
            
            settings = config.Settings()
            
            assert settings.apca_api_key_id == test_key
            assert settings.apca_api_secret_key == test_secret
            assert settings.apca_endpoint == test_endpoint
        
        # Reset module state
        importlib.reload(config)
    
    def test_is_production_method(self):
        """Test the is_production() helper method."""
        from services.config import Settings
        
        settings_dev = Settings(profile="dev")
        assert settings_dev.is_production() is False
        
        settings_prod = Settings(profile="prod")
        assert settings_prod.is_production() is True


class TestConfigDefaults:
    """Tests for default configuration values."""
    
    def test_default_timezone(self):
        """Test default timezone is America/New_York."""
        from services.config import Settings
        settings = Settings()
        assert settings.default_timezone == "America/New_York"
    
    def test_default_api_port(self):
        """Test default API port."""
        from services.config import Settings
        settings = Settings()
        assert settings.api_port == 7500
    
    def test_default_alpaca_endpoint(self):
        """Test default Alpaca endpoint is paper trading."""
        from services.config import Settings
        settings = Settings()
        assert "paper" in settings.apca_endpoint
    
    def test_timeframes_list(self):
        """Test timeframes_list property."""
        from services.config import Settings
        settings = Settings()
        timeframes = settings.timeframes_list
        assert "1m" in timeframes
        assert "5m" in timeframes
        assert "1d" in timeframes
    
    def test_symbols_list(self):
        """Test symbols_list property."""
        from services.config import Settings
        settings = Settings(ingestion_symbols="AAPL,TSLA,MSFT")
        symbols = settings.symbols_list
        assert symbols == ["AAPL", "TSLA", "MSFT"]
