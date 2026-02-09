"""
FinBERT Sentiment Provider

Uses ProsusAI/finbert for financial sentiment analysis.
FinBERT is specifically trained on financial text and provides
accurate sentiment classification for financial news.

Model: ProsusAI/finbert (BERT fine-tuned on financial phrasebank)
Output: positive, negative, neutral with confidence scores
"""

import logging
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from datetime import datetime
import os

logger = logging.getLogger(__name__)

# Lazy imports to avoid loading heavy dependencies at module level
_model = None
_tokenizer = None
_device = None

@dataclass
class FinBERTResult:
    """Result from FinBERT sentiment analysis."""
    text: str
    sentiment: str  # 'positive', 'negative', 'neutral'
    score: float    # Confidence 0-1
    normalized_score: float  # -1 to +1 scale
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text[:100] + "..." if len(self.text) > 100 else self.text,
            "sentiment": self.sentiment,
            "confidence": self.score,
            "normalized_score": self.normalized_score,
        }


class FinBERTProvider:
    """
    FinBERT-based sentiment analysis provider.
    
    Uses HuggingFace transformers to run ProsusAI/finbert locally.
    Falls back gracefully if torch/transformers not available.
    """
    
    MODEL_NAME = "ProsusAI/finbert"
    
    def __init__(self, device: Optional[str] = None, cache_dir: Optional[str] = None):
        """
        Initialize FinBERT provider.
        
        Args:
            device: 'cuda', 'cpu', or None for auto-detect
            cache_dir: Directory to cache model weights
        """
        self._device = device
        self._cache_dir = cache_dir or os.environ.get("HF_HOME", None)
        self._model = None
        self._tokenizer = None
        self._available = None
        self._load_attempted = False
    
    @property
    def is_available(self) -> bool:
        """Check if FinBERT can be used."""
        if self._available is not None:
            return self._available
        
        try:
            import torch
            import transformers
            self._available = True
        except ImportError:
            self._available = False
            logger.warning("FinBERT not available: torch/transformers not installed")
        
        return self._available
    
    def _ensure_loaded(self) -> bool:
        """Lazy load model on first use."""
        if self._model is not None:
            return True
        
        if self._load_attempted:
            return False
        
        self._load_attempted = True
        
        if not self.is_available:
            return False
        
        try:
            import torch
            from transformers import AutoTokenizer, AutoModelForSequenceClassification
            
            logger.info(f"Loading FinBERT model: {self.MODEL_NAME}")
            
            # Determine device
            if self._device:
                device = self._device
            elif torch.cuda.is_available():
                device = "cuda"
            else:
                device = "cpu"
            
            # Load tokenizer and model
            self._tokenizer = AutoTokenizer.from_pretrained(
                self.MODEL_NAME, 
                cache_dir=self._cache_dir
            )
            self._model = AutoModelForSequenceClassification.from_pretrained(
                self.MODEL_NAME, 
                cache_dir=self._cache_dir
            )
            self._model.to(device)
            self._model.eval()
            self._device = device
            
            logger.info(f"FinBERT loaded successfully on {device}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load FinBERT: {e}")
            self._available = False
            return False
    
    def analyze(self, text: str) -> Optional[FinBERTResult]:
        """
        Analyze sentiment of a single text.
        
        Args:
            text: Text to analyze (headline, summary, etc.)
            
        Returns:
            FinBERTResult or None if analysis fails
        """
        if not self._ensure_loaded():
            return None
        
        try:
            import torch
            
            # Tokenize
            inputs = self._tokenizer(
                text, 
                return_tensors="pt", 
                truncation=True, 
                max_length=512,
                padding=True
            )
            inputs = {k: v.to(self._device) for k, v in inputs.items()}
            
            # Inference
            with torch.no_grad():
                outputs = self._model(**inputs)
                probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            
            # FinBERT labels: 0=positive, 1=negative, 2=neutral
            probs = probs.cpu().numpy()[0]
            positive, negative, neutral = probs[0], probs[1], probs[2]
            
            # Determine sentiment
            if positive > negative and positive > neutral:
                sentiment = "positive"
                confidence = float(positive)
            elif negative > positive and negative > neutral:
                sentiment = "negative"
                confidence = float(negative)
            else:
                sentiment = "neutral"
                confidence = float(neutral)
            
            # Normalize to -1 to +1 scale
            # positive contributes +, negative contributes -
            normalized = float(positive - negative)
            
            return FinBERTResult(
                text=text,
                sentiment=sentiment,
                score=confidence,
                normalized_score=normalized,
            )
            
        except Exception as e:
            logger.error(f"FinBERT analysis failed: {e}")
            return None
    
    def analyze_batch(self, texts: List[str]) -> List[Optional[FinBERTResult]]:
        """
        Analyze sentiment of multiple texts.
        
        Args:
            texts: List of texts to analyze
            
        Returns:
            List of FinBERTResult (None for failed analyses)
        """
        if not self._ensure_loaded():
            return [None] * len(texts)
        
        try:
            import torch
            
            # Tokenize batch
            inputs = self._tokenizer(
                texts, 
                return_tensors="pt", 
                truncation=True, 
                max_length=512,
                padding=True
            )
            inputs = {k: v.to(self._device) for k, v in inputs.items()}
            
            # Inference
            with torch.no_grad():
                outputs = self._model(**inputs)
                probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            
            probs = probs.cpu().numpy()
            
            results = []
            for i, text in enumerate(texts):
                positive, negative, neutral = probs[i][0], probs[i][1], probs[i][2]
                
                if positive > negative and positive > neutral:
                    sentiment = "positive"
                    confidence = float(positive)
                elif negative > positive and negative > neutral:
                    sentiment = "negative"
                    confidence = float(negative)
                else:
                    sentiment = "neutral"
                    confidence = float(neutral)
                
                normalized = float(positive - negative)
                
                results.append(FinBERTResult(
                    text=text,
                    sentiment=sentiment,
                    score=confidence,
                    normalized_score=normalized,
                ))
            
            return results
            
        except Exception as e:
            logger.error(f"FinBERT batch analysis failed: {e}")
            return [None] * len(texts)
    
    def health_check(self) -> Dict[str, Any]:
        """Check provider health."""
        return {
            "provider": "finbert",
            "available": self.is_available,
            "loaded": self._model is not None,
            "device": self._device if self._model else None,
            "model": self.MODEL_NAME,
        }


# Global instance
_finbert_provider: Optional[FinBERTProvider] = None


def get_finbert_provider() -> FinBERTProvider:
    """Get or create global FinBERT provider."""
    global _finbert_provider
    if _finbert_provider is None:
        _finbert_provider = FinBERTProvider()
    return _finbert_provider
