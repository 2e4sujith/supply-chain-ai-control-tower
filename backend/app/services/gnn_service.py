"""
GNN Inference and Graph Explainability Service.

Provides production inference and graph-structural explainability using the
trained Graph Convolutional Network (GCN) model.
"""

import logging
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from app.ml.gnn_model import SupplyChainGCN, load_gnn_model

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_GNN_PATH = BASE_DIR / "models" / "gnn_gcn.json"


class GNNService:
    """
    Singleton service managing GCN model inference, graph representation,
    and topological risk attribution.
    """

    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = model_path or DEFAULT_GNN_PATH
        self.model: Optional[SupplyChainGCN] = None
        self._load_model()

    def _load_model(self) -> None:
        """Load trained GNN model weights if available."""
        if self.model_path.exists():
            try:
                self.model = load_gnn_model(self.model_path)
                logger.info(f"Loaded GCN model successfully from {self.model_path}")
            except Exception as e:
                logger.error(f"Failed to load GCN model from {self.model_path}: {e}")
                self.model = None
        else:
            logger.warning(f"GCN model file not found at {self.model_path}. Fallback mode active.")
            self.model = None

    def _ensure_model(self) -> Optional[SupplyChainGCN]:
        if self.model is None and self.model_path.exists():
            self._load_model()
        return self.model

    @staticmethod
    def _extract_nodes(shipment_data: Dict[str, Any]) -> Tuple[str, str, str]:
        """Extract origin node, destination node, and product category node."""
        origin = (
            shipment_data.get("origin_region")
            or shipment_data.get("origin_hub")
            or shipment_data.get("origin_location")
            or shipment_data.get("origin")
            or "East_Asia"
        )
        destination = (
            shipment_data.get("destination_region")
            or shipment_data.get("dest_region")
            or shipment_data.get("destination_location")
            or shipment_data.get("destination")
            or "North_America"
        )
        category = (
            shipment_data.get("department_name")
            or shipment_data.get("Department Name")
            or shipment_data.get("product_category")
            or shipment_data.get("category")
            or "Apparel"
        )
        return str(origin), str(destination), str(category)

    def predict_gnn_risk(
        self,
        shipment_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Predict disruption risk using GCN model with structural graph attribution.
        
        Returns:
            Dict containing:
                - risk_score: int (0 to 100)
                - risk_probability: float (0.0 to 1.0)
                - risk_level: str ("Low", "Medium", "High", "Critical")
                - confidence_score: float
                - attribution: Dict (graph neighborhood breakdown)
                - model_info: Dict (architecture, hops, node count)
        """
        model = self._ensure_model()
        origin, destination, category = self._extract_nodes(shipment_data)

        if model is None:
            # Deterministic graph-informed baseline fallback
            return self._fallback_prediction(origin, destination, category, shipment_data)

        try:
            prob, attribution = model.predict_risk(origin, destination, category, shipment_data)
            risk_score = int(round(prob * 100))

            if risk_score >= 75:
                risk_level = "Critical"
            elif risk_score >= 55:
                risk_level = "High"
            elif risk_score >= 35:
                risk_level = "Medium"
            else:
                risk_level = "Low"

            # Confidence is higher when probability is further from the decision boundary (0.5)
            confidence = round(0.5 + abs(prob - 0.5), 3)

            return {
                "risk_score": risk_score,
                "risk_probability": round(prob, 4),
                "risk_level": risk_level,
                "confidence_score": confidence,
                "attribution": attribution,
                "model_info": {
                    "model_type": "Graph Convolutional Network (GCN)",
                    "framework": "Pure Spectral Laplacian",
                    "layers": 2,
                    "graph_propagation_hops": 2,
                    "total_nodes": len(model.node_names),
                    "origin_node": origin,
                    "destination_node": destination,
                    "category_node": category
                }
            }

        except Exception as e:
            logger.error(f"GNN prediction error: {e}", exc_info=True)
            return self._fallback_prediction(origin, destination, category, shipment_data)

    def _fallback_prediction(
        self,
        origin: str,
        destination: str,
        category: str,
        shipment_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Deterministic structural risk estimator if model weights are unavailable."""
        weather = float(shipment_data.get("weather_severity_index", 15.0) or 15.0)
        port = float(shipment_data.get("origin_port_congestion_index", 25.0) or 25.0)
        customs = float(shipment_data.get("customs_inspection_risk", 0.2) or 0.2)
        carrier = float(shipment_data.get("carrier_reliability_score", 0.85) or 0.85)

        prob = min(0.95, max(0.05, (weather / 100.0) * 0.3 + (port / 100.0) * 0.3 + customs * 0.25 + (1.0 - carrier) * 0.25))
        risk_score = int(round(prob * 100))

        if risk_score >= 75:
            risk_level = "Critical"
        elif risk_score >= 55:
            risk_level = "High"
        elif risk_score >= 35:
            risk_level = "Medium"
        else:
            risk_level = "Low"

        return {
            "risk_score": risk_score,
            "risk_probability": round(prob, 4),
            "risk_level": risk_level,
            "confidence_score": 0.72,
            "attribution": {
                "origin_hub": {"name": origin, "importance_pct": 28.0, "risk_contribution": 0.28, "assessment": "Standard Volume"},
                "destination_region": {"name": destination, "importance_pct": 32.0, "risk_contribution": 0.32, "assessment": "Active Corridor"},
                "product_category": {"name": category, "importance_pct": 18.0, "risk_contribution": 0.18, "assessment": "Standard Handling"},
                "corridor_disruptions": {
                    "importance_pct": 22.0,
                    "risk_contribution": round(prob * 0.5, 3),
                    "weather_index": weather,
                    "port_congestion": port,
                    "customs_risk": customs,
                    "carrier_reliability": carrier
                },
                "raw_logit": round(prob * 2.0 - 1.0, 4),
                "graph_propagation_hops": 2
            },
            "model_info": {
                "model_type": "Graph Structural Heuristic",
                "framework": "Fallback Graph Topology",
                "layers": 2,
                "origin_node": origin,
                "destination_node": destination,
                "category_node": category
            }
        }


# Singleton Instance
gnn_service = GNNService()
