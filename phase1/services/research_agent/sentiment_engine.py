"""Node 3 — LLM-free sentiment quantization + deterministic ontology tagging."""

from __future__ import annotations

import logging
import math
import os
import re
from dataclasses import dataclass
from enum import Enum
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

_FINBERT_MODEL_ID = os.getenv("RESEARCH_FINBERT_MODEL", "ProsusAI/finbert")
_FINBERT_MAX_LEN = 512


class CatalystTag(str, Enum):
    EARNINGS_BEAT = "EARNINGS_BEAT"
    EARNINGS_MISS = "EARNINGS_MISS"
    GUIDANCE_REVISION_UPWARD = "GUIDANCE_REVISION_UPWARD"
    GUIDANCE_REVISION_DOWNWARD = "GUIDANCE_REVISION_DOWNWARD"
    CEO_RESIGNATION = "CEO_RESIGNATION"
    MACRO_RATE_CUT = "MACRO_RATE_CUT"
    MACRO_RATE_HIKE = "MACRO_RATE_HIKE"
    MERGER_ACQUISITION = "MERGER_ACQUISITION"
    PRODUCT_LAUNCH = "PRODUCT_LAUNCH"
    REGULATORY_ACTION = "REGULATORY_ACTION"
    GENERAL_NEWS = "GENERAL_NEWS"


_ONTOLOGY_PATTERNS: list[tuple[re.Pattern[str], CatalystTag]] = [
    (re.compile(r"\b(beat|beats|exceeded|surpassed)\b.*\b(earnings|eps|revenue)\b", re.I), CatalystTag.EARNINGS_BEAT),
    (re.compile(r"\b(miss|missed|fell short)\b.*\b(earnings|eps|revenue)\b", re.I), CatalystTag.EARNINGS_MISS),
    (re.compile(r"\b(raised|raises|upgrade).{0,40}\b(guidance|outlook|forecast)\b", re.I), CatalystTag.GUIDANCE_REVISION_UPWARD),
    (re.compile(r"\b(cut|lowered|downgrade).{0,40}\b(guidance|outlook|forecast)\b", re.I), CatalystTag.GUIDANCE_REVISION_DOWNWARD),
    (re.compile(r"\b(ceo|chief executive).{0,30}\b(resign|step(s|ped)? down|depart)\b", re.I), CatalystTag.CEO_RESIGNATION),
    (re.compile(r"\b(rate cut|cuts rates|easing)\b", re.I), CatalystTag.MACRO_RATE_CUT),
    (re.compile(r"\b(rate hike|raises rates|tightening)\b", re.I), CatalystTag.MACRO_RATE_HIKE),
    (re.compile(r"\b(merger|acquisition|acquires|to buy)\b", re.I), CatalystTag.MERGER_ACQUISITION),
    (re.compile(r"\b(launch|unveil|introduces)\b", re.I), CatalystTag.PRODUCT_LAUNCH),
    (re.compile(r"\b(sec|fda|regulator|antitrust|investigation)\b", re.I), CatalystTag.REGULATORY_ACTION),
]

_POSITIVE_LEX = frozenset(
    "beat beats beaten surge rally gain upgrade upgraded bullish strong growth profit record high outperform raised raises".split()
)
_NEGATIVE_LEX = frozenset(
    "miss plunge drop downgrade bearish weak loss decline cut low underperform resign probe".split()
)

_CATALYST_STRENGTH: dict[CatalystTag, float] = {
    CatalystTag.EARNINGS_BEAT: 0.95,
    CatalystTag.EARNINGS_MISS: 0.95,
    CatalystTag.GUIDANCE_REVISION_UPWARD: 0.85,
    CatalystTag.GUIDANCE_REVISION_DOWNWARD: 0.85,
    CatalystTag.MACRO_RATE_CUT: 0.75,
    CatalystTag.MACRO_RATE_HIKE: 0.75,
    CatalystTag.CEO_RESIGNATION: 0.7,
    CatalystTag.MERGER_ACQUISITION: 0.8,
    CatalystTag.PRODUCT_LAUNCH: 0.6,
    CatalystTag.REGULATORY_ACTION: 0.65,
    CatalystTag.GENERAL_NEWS: 0.35,
}


def _finbert_mode() -> str:
    return os.getenv("RESEARCH_FINBERT_ENABLED", "auto").strip().lower()


def _softmax(logits: dict[str, float]) -> dict[str, float]:
    m = max(logits.values())
    exps = {k: math.exp(v - m) for k, v in logits.items()}
    total = sum(exps.values()) or 1.0
    return {k: round(v / total, 4) for k, v in exps.items()}


def _softmax_entropy(probs: dict[str, float]) -> float:
    return -sum(p * math.log(p) for p in probs.values() if p > 0)


def _lexicon_logits(text: str) -> dict[str, float]:
    tokens = re.findall(r"[a-zA-Z']+", text.lower())
    pos = sum(1 for t in tokens if t in _POSITIVE_LEX)
    neg = sum(1 for t in tokens if t in _NEGATIVE_LEX)
    neu = max(0, len(tokens) - pos - neg)
    return {"positive": float(pos + 1), "negative": float(neg + 1), "neutral": float(neu + 1)}


@lru_cache(maxsize=1)
def _finbert_runtime() -> tuple[Any, Any] | None:
    mode = _finbert_mode()
    if mode in ("0", "false", "off", "no"):
        return None
    try:
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
    except ImportError:
        if mode in ("1", "true", "on", "yes"):
            logger.warning("RESEARCH_FINBERT_ENABLED=on but transformers/torch not installed")
        return None

    try:
        tokenizer = AutoTokenizer.from_pretrained(_FINBERT_MODEL_ID)
        model = AutoModelForSequenceClassification.from_pretrained(_FINBERT_MODEL_ID)
        model.eval()
        return tokenizer, model
    except Exception as exc:
        logger.warning("FinBERT load failed (%s): %s", _FINBERT_MODEL_ID, exc)
        return None


def finbert_available() -> bool:
    return _finbert_runtime() is not None


def _finbert_logits(text: str) -> dict[str, float]:
    runtime = _finbert_runtime()
    if runtime is None:
        return _lexicon_logits(text)

    tokenizer, model = runtime
    import torch

    encoded = tokenizer(
        text[:4000],
        truncation=True,
        max_length=_FINBERT_MAX_LEN,
        return_tensors="pt",
    )
    with torch.no_grad():
        outputs = model(**encoded)
        raw = outputs.logits[0].tolist()

    id2label = getattr(model.config, "id2label", None) or {0: "positive", 1: "negative", 2: "neutral"}
    logits: dict[str, float] = {}
    for idx, logit in enumerate(raw):
        label = str(id2label.get(idx, idx)).lower()
        if "pos" in label:
            logits["positive"] = float(logit)
        elif "neg" in label:
            logits["negative"] = float(logit)
        else:
            logits["neutral"] = float(logit)
    for key in ("positive", "negative", "neutral"):
        logits.setdefault(key, 0.0)
    return logits


def tag_catalyst(text: str, event_type: str | None = None) -> CatalystTag:
    if event_type:
        normalized = event_type.upper().replace(" ", "_")
        for tag in CatalystTag:
            if tag.value == normalized:
                return tag
    for pattern, tag in _ONTOLOGY_PATTERNS:
        if pattern.search(text):
            return tag
    return CatalystTag.GENERAL_NEWS


def _ticker_mentioned(text: str, underlying: str | None) -> bool:
    if not underlying:
        return True
    pattern = re.compile(rf"\b{re.escape(underlying)}\b", re.I)
    return bool(pattern.search(text))


@dataclass
class SentimentResult:
    finbert_polarity_score: float
    softmax_probabilities: dict[str, float]
    deterministic_catalyst_tag: str
    engine: str
    confidence: float
    catalyst_strength: float
    ticker_mentioned: bool


def run_sentiment_engine(
    text: str,
    *,
    event_type: str | None = None,
    underlying: str | None = None,
) -> SentimentResult:
    runtime = _finbert_runtime()
    if runtime is not None:
        logits = _finbert_logits(text)
        engine = f"finbert_transformer:{_FINBERT_MODEL_ID}"
    else:
        logits = _lexicon_logits(text)
        engine = "lexicon_softmax_v1"

    probs = _softmax(logits)
    polarity = round(probs["positive"] - probs["negative"], 4)

    # Confidence: 1 - normalized entropy (max entropy ln(3) for 3 classes)
    entropy = _softmax_entropy(probs)
    max_entropy = math.log(3)
    confidence = round(1.0 - entropy / max_entropy, 4) if max_entropy > 0 else 0.5

    tag = tag_catalyst(text, event_type)
    catalyst_strength = _CATALYST_STRENGTH.get(tag, 0.35)
    ticker_ok = _ticker_mentioned(text, underlying)

    return SentimentResult(
        finbert_polarity_score=polarity,
        softmax_probabilities=probs,
        deterministic_catalyst_tag=tag.value,
        engine=engine,
        confidence=confidence,
        catalyst_strength=round(catalyst_strength, 2),
        ticker_mentioned=ticker_ok,
    )
