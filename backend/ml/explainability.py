"""
SHAP Explainability Module for Supply Chain AI Disruption Risk Model.

Implements exact TreeSHAP attribution for the DataCo-trained XGBoost model to explain
individual shipment disruption risk predictions, identifying top positive risk
drivers and top negative/protective factors.
"""

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

CATEGORICAL_FEATURES = [
    "Shipping Mode",
    "Type",
    "Customer Segment",
    "Market",
    "Order Region",
    "Department Name",
]

NUMERICAL_FEATURES = [
    "Days for shipment (scheduled)",
    "Order Item Product Price",
    "Order Item Quantity",
    "Order Item Discount Rate",
    "Order Item Discount",
    "Order Item Total",
    "Order Profit Per Order",
    "Order Item Profit Ratio",
    "Latitude",
    "Longitude",
    "order_hour",
    "order_dayofweek",
    "order_month",
]

FEATURE_DISPLAY_NAMES = {
    "Shipping Mode": "Shipping Mode",
    "Type": "Payment Type",
    "Customer Segment": "Customer Segment",
    "Market": "Destination Market",
    "Order Region": "Order Region",
    "Department Name": "Product Department",
    "Days for shipment (scheduled)": "Scheduled Shipping SLA (Days)",
    "Order Item Product Price": "Item Unit Price ($)",
    "Order Item Quantity": "Item Quantity",
    "Order Item Discount Rate": "Discount Rate",
    "Order Item Discount": "Discount Amount ($)",
    "Order Item Total": "Order Total ($)",
    "Order Profit Per Order": "Order Profit ($)",
    "Order Item Profit Ratio": "Profit Ratio",
    "Latitude": "Destination Latitude",
    "Longitude": "Destination Longitude",
    "order_hour": "Order Placement Hour",
    "order_dayofweek": "Order Day of Week",
    "order_month": "Order Month",
}


def _get_factor_description(feature: str, value: Any, shap_val: float) -> str:
    is_risk = shap_val > 0
    if feature == "Days for shipment (scheduled)":
        val_str = f"{value:.0f} days" if isinstance(value, (int, float)) else str(value)
        return f"Scheduled delivery window is {val_str}, {'tightening delivery SLA margin' if is_risk else 'providing ample buffer time'}."
    elif feature == "Shipping Mode":
        return f"{value} shipping tier {'increases exposure to transit variance' if is_risk else 'ensures prioritized transit lane routing'}."
    elif feature == "Order Region":
        return f"Destination region ({value}) {'experiences active corridor dwell times' if is_risk else 'operates with stable delivery clearance'}."
    elif feature == "Market":
        return f"Market sector ({value}) {'has higher historical delivery volatility' if is_risk else 'maintains high on-time fulfillment rates'}."
    elif feature == "Department Name":
        return f"Product category ({value}) {'requires specialized handling delays' if is_risk else 'benefits from standard automated fulfillment'}."
    elif feature == "Order Item Total":
        val_str = f"${value:,.2f}" if isinstance(value, (int, float)) else str(value)
        return f"Consolidated order value is {val_str}, {'influencing high-priority sorting' if is_risk else 'within standard fulfillment batch'}."
    elif feature == "Order Item Discount Rate":
        val_str = f"{value:.1%}" if isinstance(value, (int, float)) else str(value)
        return f"Order promotional discount of {val_str} {'correlates with peak seasonal demand surges' if is_risk else 'reflects standard baseline pricing'}."
    elif feature == "Customer Segment":
        return f"{value} customer order profile {'imposes strict delivery expectations' if is_risk else 'follows flexible delivery window'}."
    elif feature == "Type":
        return f"{value} transaction verification {'adds order clearance latency' if is_risk else 'provides instantaneous order release'}."
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
            for cat_val in self.cat_categories.get(cat, []):
                vec.append(1.0 if val == cat_val else 0.0)
        for num in NUMERICAL_FEATURES:
            mean = self.num_means.get(num, 0.0)
            std = self.num_stds.get(num, 1.0)
            val = float(record.get(num, mean))
            norm_val = (val - mean) / (std if std > 0 else 1.0)
            vec.append(norm_val)
        return vec


class PureTreeSHAP:
    """Exact TreeSHAP attribution engine for decision tree ensembles."""
    def __init__(self, xgb_data: dict):
        self.base_score = xgb_data.get("base_score", 0.0)
        self.learning_rate = xgb_data.get("learning_rate", 1.0)
        self.trees = xgb_data.get("trees", [])
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
            cur = Path(__file__).resolve()
            candidates = [
                cur.parent.parent.parent / "models",
                cur.parent.parent / "models",
                Path.cwd() / "backend" / "models",
                Path.cwd() / "models",
            ]
            for c in candidates:
                if (c / "preprocessor.json").exists():
                    models_dir = c
                    break
            if models_dir is None:
                models_dir = candidates[0]

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

        # Group encoded features into original high-level features
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
            
            if abs_val >= 0.20:
                magnitude = "CRITICAL"
            elif abs_val >= 0.10:
                magnitude = "HIGH"
            elif abs_val >= 0.03:
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
