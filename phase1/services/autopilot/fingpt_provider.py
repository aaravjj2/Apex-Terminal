"""
FinGPT Sentiment Provider

Uses FinGPT models for financial sentiment analysis.
FinGPT is an open-source LLM fine-tuned specifically for financial NLP tasks.

Supports multiple model variants:
- fingpt-sentiment (lightweight, fast)
- fingpt-sentiment-llama (more accurate)

Falls back to Groq API if local inference unavailable.
"""

import logging
import os
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

# Lazy imports
_model = None
_tokenizer = None


@dataclass 
class FinGPTResult:
    """Result from FinGPT sentiment analysis."""
    text: str
    sentiment: str  # 'positive', 'negative', 'neutral'
    score: float    # Confidence 0-1
    normalized_score: float  # -1 to +1 scale
    model_used: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text[:100] + "..." if len(self.text) > 100 else self.text,
            "sentiment": self.sentiment,
            "confidence": self.score,
            "normalized_score": self.normalized_score,
            "model": self.model_used,
        }


class FinGPTProvider:
    """
    FinGPT-based sentiment analysis provider.
    
    Uses HuggingFace transformers for local inference, 
    or falls back to Groq API with financial prompting.
    """
    
    # Model variants in preference order
    MODELS = [
        "FinGPT/fingpt-sentiment_llama2-13b_lora",
        "FinGPT/fingpt-sentiment",
        "mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis",
    ]
    
    def __init__(
        self, 
        model_name: Optional[str] = None,
        device: Optional[str] = None,
        use_groq_fallback: bool = True,
        groq_api_key: Optional[str] = None,
    ):
        """
        Initialize FinGPT provider.
        
        Args:
            model_name: Specific model to use (or auto-select)
            device: 'cuda', 'cpu', or None for auto-detect
            use_groq_fallback: Use Groq API if local not available
            groq_api_key: API key for Groq fallback
        """
        self._model_name = model_name
        self._device = device
        self._use_groq_fallback = use_groq_fallback
        self._groq_api_key = groq_api_key or os.environ.get("GROQ_API_KEY")
        
        self._model = None
        self._tokenizer = None
        self._pipeline = None
        self._available = None
        self._load_attempted = False
        self._active_model = None
    
    @property
    def is_available(self) -> bool:
        """Check if FinGPT can be used (local or fallback)."""
        if self._available is not None:
            return self._available
        
        # Check for local
        try:
            import torch
            import transformers
            self._available = True
            return True
        except ImportError:
            pass
        
        # Check for Groq fallback
        if self._use_groq_fallback and self._groq_api_key:
            self._available = True
            return True
        
        self._available = False
        logger.warning("FinGPT not available: no local models or Groq API")
        return False
    
    def _ensure_loaded(self) -> bool:
        """Lazy load model on first use."""
        if self._pipeline is not None or self._active_model == "groq":
            return True
        
        if self._load_attempted:
            return self._active_model is not None
        
        self._load_attempted = True
        
        # Try local models first
        try:
            import torch
            from transformers import pipeline
            
            # Determine device
            if self._device:
                device = 0 if self._device == "cuda" else -1
            elif torch.cuda.is_available():
                device = 0
            else:
                device = -1
            
            # Try lighter model that's more likely to work
            model_to_use = self._model_name or "mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis"
            
            logger.info(f"Loading FinGPT model: {model_to_use}")
            
            self._pipeline = pipeline(
                "text-classification",
                model=model_to_use,
                device=device,
                top_k=None,  # Return all scores
            )
            
            self._active_model = model_to_use
            self._device = "cuda" if device == 0 else "cpu"
            logger.info(f"FinGPT loaded successfully: {model_to_use} on {self._device}")
            return True
            
        except Exception as e:
            logger.warning(f"Local FinGPT failed: {e}")
        
        # Fall back to Groq
        if self._use_groq_fallback and self._groq_api_key:
            self._active_model = "groq"
            logger.info("Using Groq API fallback for FinGPT-style analysis")
            return True
        
        logger.error("FinGPT: no models available")
        return False
    
    def analyze(self, text: str) -> Optional[FinGPTResult]:
        """
        Analyze sentiment of a single text.
        
        Args:
            text: Text to analyze (headline, summary, etc.)
            
        Returns:
            FinGPTResult or None if analysis fails
        """
        if not self._ensure_loaded():
            return None
        
        try:
            if self._active_model == "groq":
                return self._analyze_with_groq(text)
            else:
                return self._analyze_with_pipeline(text)
        except Exception as e:
            logger.error(f"FinGPT analysis failed: {e}")
            return None
    
    def _analyze_with_pipeline(self, text: str) -> Optional[FinGPTResult]:
        """Analyze using local HuggingFace pipeline."""
        try:
            results = self._pipeline(text[:512])  # Truncate for safety
            
            # Results is list of dicts with 'label' and 'score'
            if isinstance(results, list) and len(results) > 0:
                # Handle nested list from top_k=None
                if isinstance(results[0], list):
                    results = results[0]
                
                # Find best sentiment
                best = max(results, key=lambda x: x['score'])
                label = best['label'].lower()
                confidence = best['score']
                
                # Map labels to standard format
                if 'pos' in label or 'bull' in label:
                    sentiment = "positive"
                    normalized = confidence
                elif 'neg' in label or 'bear' in label:
                    sentiment = "negative"
                    normalized = -confidence
                else:
                    sentiment = "neutral"
                    normalized = 0.0
                
                return FinGPTResult(
                    text=text,
                    sentiment=sentiment,
                    score=confidence,
                    normalized_score=normalized,
                    model_used=self._active_model,
                )
        except Exception as e:
            logger.error(f"Pipeline analysis error: {e}")
        
        return None
    
    def _analyze_with_groq(self, text: str) -> Optional[FinGPTResult]:
        """Analyze using Groq API with financial prompting."""
        try:
            import requests
            
            prompt = f"""Analyze the financial sentiment of this text. Respond with ONLY a JSON object:
{{"sentiment": "positive|negative|neutral", "confidence": 0.0-1.0, "score": -1.0 to 1.0}}

Text: {text[:500]}"""

            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self._groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "mixtral-8x7b-32768",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "max_tokens": 100,
                },
                timeout=10,
            )
            
            if response.status_code == 200:
                content = response.json()["choices"][0]["message"]["content"]
                
                # Parse JSON response
                import json
                # Try to extract JSON from response
                if "{" in content:
                    json_str = content[content.find("{"):content.rfind("}")+1]
                    data = json.loads(json_str)
                    
                    return FinGPTResult(
                        text=text,
                        sentiment=data.get("sentiment", "neutral"),
                        score=data.get("confidence", 0.5),
                        normalized_score=data.get("score", 0.0),
                        model_used="groq-mixtral",
                    )
        except Exception as e:
            logger.error(f"Groq analysis error: {e}")
        
        return None
    
    def analyze_batch(self, texts: List[str]) -> List[Optional[FinGPTResult]]:
        """Analyze multiple texts."""
        return [self.analyze(text) for text in texts]
    
    def health_check(self) -> Dict[str, Any]:
        """Check provider health."""
        return {
            "provider": "fingpt",
            "available": self.is_available,
            "loaded": self._active_model is not None,
            "active_model": self._active_model,
            "device": self._device if self._pipeline else None,
            "groq_fallback": self._use_groq_fallback,
        }


# Global instance
_fingpt_provider: Optional[FinGPTProvider] = None


def get_fingpt_provider() -> FinGPTProvider:
    """Get or create global FinGPT provider."""
    global _fingpt_provider
    if _fingpt_provider is None:
        _fingpt_provider = FinGPTProvider()
    return _fingpt_provider
