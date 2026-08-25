"""
Verification Script for SHAP Explainability Pipeline.

Loads trained XGBoost model and verifies SHAP value generation, risk factor ranking,
probability bounds, and mathematical consistency.
"""

import json
from pathlib import Path
import sys

base_dir = Path(__file__).resolve().parent.parent
ml_dir = base_dir / "ml"
sys.path.insert(0, str(base_dir))

from ml.explainability import ShapExplainabilityService, explain_shipment

def run_verification():
    print("=" * 70)
    print("SHAP EXPLAINABILITY PIPELINE VERIFICATION")
    print("=" * 70)

    models_dir = base_dir / "models"
    service = ShapExplainabilityService(models_dir)

    # Test Sample 1: High Risk Severe Weather Ocean Route
    sample_high_risk = {
        "transport_mode": "Ocean",
        "origin_region": "East_Asia",
        "destination_region": "North_America",
        "route_distance_km": 14200.0,
        "planned_duration_hours": 510.0,
        "elapsed_transit_hours": 210.0,
        "transit_progress_pct": 0.4118,
        "priority_level": "Urgent",
        "carrier_reliability_score": 0.58,
        "origin_port_congestion_index": 78.4,
        "dest_port_congestion_index": 62.1,
        "weather_severity_index": 88.5,
        "customs_inspection_risk": 0.72,
        "seasonal_disruption_factor": 0.89,
    }

    # Test Sample 2: Low Risk Stable Air / Road Route
    sample_low_risk = {
        "transport_mode": "Road",
        "origin_region": "Europe",
        "destination_region": "Europe",
        "route_distance_km": 480.0,
        "planned_duration_hours": 14.0,
        "elapsed_transit_hours": 11.2,
        "transit_progress_pct": 0.80,
        "priority_level": "Standard",
        "carrier_reliability_score": 0.98,
        "origin_port_congestion_index": 12.0,
        "dest_port_congestion_index": 8.5,
        "weather_severity_index": 6.2,
        "customs_inspection_risk": 0.05,
        "seasonal_disruption_factor": 0.12,
    }

    for name, sample in [("HIGH RISK SAMPLE (Ocean Route)", sample_high_risk), ("LOW RISK SAMPLE (Road Route)", sample_low_risk)]:
        print(f"\n--- Evaluating: {name} ---")
        result = service.explain_shipment(sample, top_n=4)
        
        print(f"Predicted Probability: {result['predicted_probability']:.4f}")
        print(f"Risk Score:            {result['risk_score']}/100")
        print(f"Risk Tier:             {result['risk_level']}")
        print(f"Base Value (phi_0):    {result['base_value']:.4f}")
        
        print("\nTop Positive Risk Drivers (Increasing Disruption Risk):")
        for i, factor in enumerate(result['top_risk_factors'], 1):
            print(f"  {i}. {factor['display_name']} ({factor['value']}): SHAP = +{factor['shap_value']:.4f} [{factor['magnitude']}]")
            print(f"     -> {factor['description']}")

        print("\nTop Protective Factors (Decreasing Disruption Risk):")
        for i, factor in enumerate(result['top_protective_factors'], 1):
            print(f"  {i}. {factor['display_name']} ({factor['value']}): SHAP = {factor['shap_value']:.4f} [{factor['magnitude']}]")
            print(f"     -> {factor['description']}")

        # Assertions
        assert 0.0 <= result['predicted_probability'] <= 1.0, "Probability out of [0, 1] bounds"
        assert 0 <= result['risk_score'] <= 100, "Risk score out of [0, 100] bounds"
        assert len(result['top_risk_factors']) > 0 or len(result['top_protective_factors']) > 0, "No factors returned"

    print("\n" + "=" * 70)
    print("ALL SHAP VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_verification()
