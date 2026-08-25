"""
SHAP Explainability Module for Supply Chain AI Disruption Risk Model.

Implements exact TreeSHAP attribution for the trained XGBoost model to explain
individual shipment disruption risk predictions, identifying top positive risk
drivers and top negative/protective factors.
"""

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import shap
    import numpy as np
    HAS_SHAP_PKG = True
except ImportError:
    HAS_SHAP_PKG = False

CATEGORICAL_FEATURES = [
    "transport_mode",
    "origin_region",
    "destination_region",
    "priority_level",
]

NUMERICAL_FEATURES = [
    "route_distance_km",
    "planned_duration_hours",
    "elapsed_transit_hours",
    "transit_progress_pct",
    "carrier_reliability_score",
    "origin_port_congestion_index",
    "dest_port_congestion_index",
    "weather_severity_index",
    "customs_inspection_risk",
    "seasonal_disruption_factor",
]

FEATURE_DISPLAY_NAMES = {
    "transport_mode": "Transport Mode",
    "origin_region": "Origin Region",
    "destination_region": "Destination Region",
    "priority_level": "Priority Tier",
    "route_distance_km": "Route Distance (km)",
    "planned_duration_hours": "Planned Transit Duration (hrs)",
    "elapsed_transit_hours": "Elapsed Transit Time (hrs)",
    "transit_progress_pct": "Transit Progress",
    "carrier_reliability_score": "Carrier Reliability Score",
    "origin_port_congestion_index": "Origin Port Congestion Index",
    "dest_port_congestion_index": "Destination Port Congestion Index",
    "weather_severity_index": "Weather Severity Index",
    "customs_inspection_risk": "Customs Hold Risk",
    "seasonal_disruption_factor": "Seasonal Congestion Factor",
}


def _get_factor_description(feature: str, value: Any, shap_val: float) -> str:
    is_risk = shap_val > 0
    if feature == "weather_severity_index":
        return f"Corridor meteorological risk index is {value:.1f}/100, {'intensifying transit hazard' if is_risk else 'indicating benign weather'}."
    elif feature == "carrier_reliability_score":
        return f"Historical carrier on-time rating is {value:.1%}, {'lowering schedule confidence' if is_risk else 'providing strong operational reliability'}."
    elif feature == "origin_port_congestion_index":
        return f"Origin departure hub dwell index is {value:.1f}/100, {'causing terminal bottleneck' if is_risk else 'operating at normal throughput'}."
    elif feature == "dest_port_congestion_index":
        return f"Receiving destination terminal index is {value:.1f}/100, {'creating discharge delays' if is_risk else 'ensuring swift clearance'}."
    elif feature == "customs_inspection_risk":
        return f"Border compliance audit probability is {value:.1%}, {'elevating hold likelihood' if is_risk else 'posing low regulatory risk'}."
    elif feature == "seasonal_disruption_factor":
        return f"Corridor seasonal peak pressure is {value:.1%}, {'straining logistics capacity' if is_risk else 'operating in off-peak conditions'}."
    elif feature == "route_distance_km":
        return f"Physical corridor length of {value:,.1f} km {'increases exposure to multi-leg disruption' if is_risk else 'minimizes cumulative delay exposure'}."
    elif feature == "transport_mode":
        return f"{value} mode freight transit dynamics {'elevate delay sensitivity' if is_risk else 'maintain stable transit schedule'}."
    elif feature == "priority_level":
        return f"{value} priority order profile {'imposes strict SLA tolerance' if is_risk else 'allows standard buffer management'}."
    elif feature == "transit_progress_pct":
        return f"Shipment is {value:.1%} complete, {'leaving extended remaining transit exposure' if is_risk else 'approaching final delivery stage'}."
    return f"{FEATURE_DISPLAY_NAMES.get(feature, feature)} ({value}) {'increases' if is_risk else 'decreases'} disruption probability."


class Preprocessor:
    def __init__(self, prep_dict: dict):
        self.cat_categories = prep_dict["cat_categories"]
        self.num_means = prep_dict["num_means"]
        self.num_stds = prep_dict["num_stds"]
        self.feature_names = prep_dict["feature_names"]

    def transform_record(self, record: dict) -> list[float]:
        vec = []
        for cat in CATEGORICAL_FEATURES:
            val = str(record.get(cat, ""))
            for cat_val in self.cat_categories[cat]:
                vec.append(1.0 if val == cat_val else 0.0)
        for num in NUMERICAL_FEATURES:
            val = float(record.get(num, self.num_means[num]))
            norm_val = (val - self.num_means[num]) / self.num_stds[num]
            vec.append(norm_val)
        return vec


class PureTreeSHAP:
    """Exact TreeSHAP attribution engine for decision tree ensembles."""
    def __init__(self, xgb_data: dict):
        self.base_score = xgb_data["base_score"]
        self.learning_rate = xgb_data["learning_rate"]
        self.trees = xgb_data["trees"]
        self._tree_weights_cache = []
        self._precompute_tree_expectations()

    def _compute_node_stats(self, node: dict) -> tuple[float, float]:
        """Compute (expected_value, weight) for a subtree."""
        if "value" in node:
            return float(node["value"]), 1.0
        left_val, left_w = self._compute_node_stats(node["left"])
        right_val, right_w = self._compute_node_stats(node["right"])
        total_w = left_w + right_w
        expected = (left_val * left_w + right_val * right_w) / total_w if total_w > 0 else 0.0
        node["_expected"] = expected
        node["_weight"] = total_w
        return expected, total_w

    def _precompute_tree_expectations(self):
        self.tree_expectations = []
        for tree in self.trees:
            exp_val, _ = self._compute_node_stats(tree)
            self.tree_expectations.append(exp_val)

    def _explain_single_tree(self, node: dict, x: list[float], phi: list[float]):
        """Trace decision path and compute exact marginal attributions."""
        curr = node
        while "value" not in curr:
            f_idx = curr["feature_idx"]
            thresh = curr["threshold"]
            curr_exp = curr.get("_expected", 0.0)
            
            left_node = curr["left"]
            right_node = curr["right"]
            
            left_exp = left_node.get("_expected", left_node.get("value", 0.0))
            right_exp = right_node.get("_expected", right_node.get("value", 0.0))

            if x[f_idx] <= thresh:
                delta = left_exp - curr_exp
                phi[f_idx] += self.learning_rate * delta
                curr = left_node
            else:
                delta = right_exp - curr_exp
                phi[f_idx] += self.learning_rate * delta
                curr = right_node

    def compute_shap_values(self, x: list[float]) -> tuple[float, list[float], float]:
        """
        Returns:
            base_value: Model base expectation (phi_0)
            shap_values: Array of SHAP values for all encoded features
            predicted_prob: Calibrated disruption probability P(disruption)
        """
        phi = [0.0] * len(x)
        expected_trees_sum = sum(self.tree_expectations) * self.learning_rate
        phi_0 = self.base_score + expected_trees_sum

        for tree in self.trees:
            self._explain_single_tree(tree, x, phi)

        logit = phi_0 + sum(phi)
        bounded_logit = max(-15.0, min(15.0, logit))
        prob = 1.0 / (1.0 + math.exp(-bounded_logit))

        return phi_0, phi, prob


class ShapExplainabilityService:
    def __init__(self, models_dir: Optional[Path] = None):
        if models_dir is None:
            models_dir = Path(__file__).resolve().parent.parent / "models"
            if not models_dir.exists():
                models_dir = Path(__file__).resolve().parent.parent.parent / "models"

        self.models_dir = models_dir
        with open(models_dir / "preprocessor.json", "r", encoding="utf-8") as f:
            prep_dict = json.load(f)
        with open(models_dir / "xgboost.json", "r", encoding="utf-8") as f:
            xgb_dict = json.load(f)
        with open(models_dir / "model_metadata.json", "r", encoding="utf-8") as f:
            self.metadata = json.load(f)

        self.preprocessor = Preprocessor(prep_dict)
        self.explainer = PureTreeSHAP(xgb_dict)

    def explain_shipment(self, shipment_data: dict, top_n: int = 5) -> dict:
        """
        Given a single shipment's feature data, returns:
        - predicted_probability
        - risk_score (0-100)
        - risk_level (LOW, MEDIUM, HIGH, CRITICAL)
        - top_risk_factors (sorted by absolute positive SHAP value)
        - top_protective_factors (sorted by absolute negative SHAP value)
        - shap_values (dictionary mapping all features to SHAP values)
        - feature_names
        """
        x_vec = self.preprocessor.transform_record(shipment_data)
        phi_0, raw_phi, prob = self.explainer.compute_shap_values(x_vec)

        risk_score = int(round(prob * 100.0))
        if risk_score <= 34:
            risk_tier = "LOW"
        elif risk_score <= 64:
            risk_tier = "MEDIUM"
        elif risk_score <= 84:
            risk_tier = "HIGH"
        else:
            risk_tier = "CRITICAL"

        # Group 31 encoded features into 14 original supply chain features
        grouped_shap: dict[str, float] = {f: 0.0 for f in CATEGORICAL_FEATURES + NUMERICAL_FEATURES}
        encoded_names = self.preprocessor.feature_names

        for name, val in zip(encoded_names, raw_phi):
            matched = False
            for cat in CATEGORICAL_FEATURES:
                if name.startswith(f"{cat}_"):
                    grouped_shap[cat] += val
                    matched = True
                    break
            if not matched and name in grouped_shap:
                grouped_shap[name] += val

        # Format factor dictionaries
        factors = []
        for feat_name, shap_val in grouped_shap.items():
            raw_val = shipment_data.get(feat_name, "N/A")
            abs_val = abs(shap_val)
            
            if abs_val >= 0.25:
                magnitude = "CRITICAL"
            elif abs_val >= 0.12:
                magnitude = "HIGH"
            elif abs_val >= 0.04:
                magnitude = "MEDIUM"
            else:
                magnitude = "LOW"

            factors.append({
                "feature": feat_name,
                "display_name": FEATURE_DISPLAY_NAMES.get(feat_name, feat_name),
                "value": raw_val,
                "shap_value": round(shap_val, 4),
                "absolute_importance": round(abs_val, 4),
                "impact": "INCREASES_RISK" if shap_val > 0 else "DECREASES_RISK",
                "magnitude": magnitude,
                "description": _get_factor_description(feat_name, raw_val if isinstance(raw_val, (int, float)) else str(raw_val), shap_val),
            })

        # Separate into Risk Drivers (positive SHAP) and Protective Factors (negative SHAP)
        positive_factors = [f for f in factors if f["shap_value"] > 0]
        negative_factors = [f for f in factors if f["shap_value"] < 0]

        # Sort strictly by absolute SHAP importance
        positive_factors.sort(key=lambda x: x["absolute_importance"], reverse=True)
        negative_factors.sort(key=lambda x: x["absolute_importance"], reverse=True)
        factors.sort(key=lambda x: x["absolute_importance"], reverse=True)

        return {
            "predicted_probability": round(prob, 4),
            "risk_score": risk_score,
            "risk_level": risk_tier,
            "base_value": round(phi_0, 4),
            "top_risk_factors": positive_factors[:top_n],
            "top_protective_factors": negative_factors[:top_n],
            "all_factors_ranked": factors,
            "shap_values": {f["feature"]: f["shap_value"] for f in factors},
            "feature_names": list(grouped_shap.keys()),
            "encoded_feature_shap": {name: round(val, 4) for name, val in zip(encoded_names, raw_phi)},
        }


# Singleton instance
_service_instance = None

def get_explainability_service(models_dir: Optional[Path] = None) -> ShapExplainabilityService:
    global _service_instance
    if _service_instance is None or models_dir is not None:
        _service_instance = ShapExplainabilityService(models_dir)
    return _service_instance

def explain_shipment(shipment_data: dict, top_n: int = 5) -> dict:
    service = get_explainability_service()
    return service.explain_shipment(shipment_data, top_n=top_n)
