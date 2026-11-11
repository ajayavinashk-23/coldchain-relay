import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.incident_service import analyze_incident
from app.rescue_engine import find_compatible_providers


def test_provider_matching_returns_only_eligible_capacity():
    providers = find_compatible_providers("seafood", 500, 2)
    assert [provider["id"] for provider in providers] == [
        "provider-B",
        "provider-C",
    ]


def test_provider_matching_rejects_insufficient_capacity():
    providers = find_compatible_providers("seafood", 2000, 2)
    assert providers == []


def test_provider_matching_rejects_unsupported_product():
    providers = find_compatible_providers("dairy", 500, 2)
    assert providers == []


def test_incident_is_normal_when_current_equals_required():
    result = analyze_incident("seafood", 500, 2, 2)
    assert result["severity"] == "NORMAL"
    assert result["rescue_required"] is False


def test_incident_is_critical_above_demo_threshold():
    result = analyze_incident("seafood", 500, 8.5, 2)
    assert result["severity"] == "CRITICAL"
    assert result["rescue_required"] is True
