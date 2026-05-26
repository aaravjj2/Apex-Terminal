import json
import math

from services.json_util import json_safe


def test_json_safe_replaces_nan_and_inf():
    payload = {"a": float("nan"), "b": [float("inf"), 1.0], "c": {"d": -float("inf")}}
    cleaned = json_safe(payload)
    json.dumps(cleaned)
    assert cleaned == {"a": None, "b": [None, 1.0], "c": {"d": None}}


def test_json_safe_preserves_finite_floats():
    assert json_safe(3.14) == 3.14
