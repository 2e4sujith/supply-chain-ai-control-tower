"""
Graph Convolutional Network (GCN / GNN) for Supply Chain Disruption Risk.

Implements:
1. Heterogeneous supply chain network topology:
   - Regional Logistics Hubs (Origins & Intermediary transit nodes)
   - Destination Regions / Markets
   - Product Categories / Departments
2. Normalized spectral graph convolution:
   - A_hat = D_tilde^(-1/2) * (A + I_N) * D_tilde^(-1/2)
   - H^(1) = ReLU(A_hat * X * W_0 + b_0)
   - H^(2) = ReLU(A_hat * H^(1) * W_1 + b_1)
3. Multi-modal Link Risk Readout Head:
   - Fuses Origin Hub Embedding (h_u), Destination Region Embedding (h_v),
     Category Embedding (h_c), and normalized transaction features x_tx
     (mode, priority, distance, planned_duration, weather, port congestion, customs, reliability).
   - P(disruption = 1) = Sigmoid(W_out * ReLU(W_fuse * [h_u || h_v || h_c || x_tx] + b_fuse) + b_out)
4. Graph Neighborhood Attribution Engine:
   - Decomposes link risk into Origin Hub vulnerability, Destination Corridor dwell factor,
     Category fragility, and Dynamic Transit Lane disruption impact.
"""

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union


def _sigmoid(x: float) -> float:
    if x < -45.0:
        return 0.0
    if x > 45.0:
        return 1.0
    return 1.0 / (1.0 + math.exp(-x))


def _relu(x: float) -> float:
    return max(0.0, x)


def _mat_vec_mul(matrix: List[List[float]], vector: List[float]) -> List[float]:
    """Matrix-vector multiplication M * v."""
    nrows = len(matrix)
    ncols = len(vector)
    out = [0.0] * nrows
    for i in range(nrows):
        row = matrix[i]
        s = 0.0
        for j in range(ncols):
            s += row[j] * vector[j]
        out[i] = s
    return out


def _mat_mat_mul(A: List[List[float]], B: List[List[float]]) -> List[List[float]]:
    """Matrix-matrix multiplication A * B."""
    n = len(A)
    m = len(B)
    p = len(B[0]) if m > 0 else 0
    out = [[0.0] * p for _ in range(n)]
    for i in range(n):
        for k in range(m):
            a_ik = A[i][k]
            if a_ik == 0.0:
                continue
            for j in range(p):
                out[i][j] += a_ik * B[k][j]
    return out


class SupplyChainGCN:
    """
    Production Graph Convolutional Network Engine for Supply Chain Risk Modeling.
    """

    def __init__(self, model_dict: Optional[Dict[str, Any]] = None):
        if model_dict:
            self.load_from_dict(model_dict)
        else:
            self.node_names: List[str] = []
            self.node_to_idx: Dict[str, int] = {}
            self.node_types: Dict[str, str] = {}
            self.node_features: List[List[float]] = []
            self.adj_matrix: List[List[float]] = []
            self.norm_adj_matrix: List[List[float]] = []

            # GCN Layer 1
            self.W0: List[List[float]] = []  # shape: (in_dim, hidden_dim)
            self.b0: List[float] = []        # shape: (hidden_dim,)

            # GCN Layer 2
            self.W1: List[List[float]] = []  # shape: (hidden_dim, embed_dim)
            self.b1: List[float] = []        # shape: (embed_dim,)

            # Readout / Link Head
            self.W_fuse: List[List[float]] = [] # shape: (3*embed_dim + tx_dim, readout_hidden)
            self.b_fuse: List[float] = []       # shape: (readout_hidden,)
            self.W_out: List[List[float]] = []  # shape: (readout_hidden, 1)
            self.b_out: float = 0.0

            # Feature metadata
            self.tx_feature_names: List[str] = []
            self.tx_means: Dict[str, float] = {}
            self.tx_stds: Dict[str, float] = {}
            self.node_embeddings: List[List[float]] = []
            self.metadata: Dict[str, Any] = {}

    def load_from_dict(self, data: Dict[str, Any]) -> None:
        """Load trained model weights and graph configuration from dictionary."""
        self.node_names = data["node_names"]
        self.node_to_idx = {name: i for i, name in enumerate(self.node_names)}
        self.node_types = data.get("node_types", {})
        self.node_features = data["node_features"]
        self.adj_matrix = data["adj_matrix"]
        self.norm_adj_matrix = data.get("norm_adj_matrix", [])
        if not self.norm_adj_matrix:
            self.norm_adj_matrix = self.compute_normalized_adjacency(self.adj_matrix)

        self.W0 = data["W0"]
        self.b0 = data["b0"]
        self.W1 = data["W1"]
        self.b1 = data["b1"]

        self.W_fuse = data["W_fuse"]
        self.b_fuse = data["b_fuse"]
        self.W_out = data["W_out"]
        self.b_out = float(data["b_out"])

        self.tx_feature_names = data.get("tx_feature_names", [])
        self.tx_means = data.get("tx_means", {})
        self.tx_stds = data.get("tx_stds", {})
        self.metadata = data.get("metadata", {})

        # Precompute contextual node embeddings via GCN forward pass
        self.node_embeddings = self.compute_node_embeddings()

    def to_dict(self) -> Dict[str, Any]:
        """Serialize GCN model parameters, graph structure, and metadata."""
        return {
            "node_names": self.node_names,
            "node_types": self.node_types,
            "node_features": self.node_features,
            "adj_matrix": self.adj_matrix,
            "norm_adj_matrix": self.norm_adj_matrix,
            "W0": self.W0,
            "b0": self.b0,
            "W1": self.W1,
            "b1": self.b1,
            "W_fuse": self.W_fuse,
            "b_fuse": self.b_fuse,
            "W_out": self.W_out,
            "b_out": self.b_out,
            "tx_feature_names": self.tx_feature_names,
            "tx_means": self.tx_means,
            "tx_stds": self.tx_stds,
            "metadata": self.metadata,
        }

    @staticmethod
    def compute_normalized_adjacency(A: List[List[float]]) -> List[List[float]]:
        """
        Compute symmetric degree-normalized adjacency with self-loops:
        A_tilde = A + I_N
        D_tilde(i, i) = sum_j A_tilde(i, j)
        A_hat = D_tilde^(-1/2) * A_tilde * D_tilde^(-1/2)
        """
        n = len(A)
        # Add self-loops (A_tilde = A + I)
        A_tilde = [[A[i][j] + (1.0 if i == j else 0.0) for j in range(n)] for i in range(n)]
        
        # Compute degrees
        deg = [0.0] * n
        for i in range(n):
            deg[i] = sum(A_tilde[i][j] for j in range(n))

        # D_inv_sqrt
        deg_inv_sqrt = [1.0 / math.sqrt(d) if d > 0.0 else 0.0 for d in deg]

        # Normalized adjacency
        A_hat = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if A_tilde[i][j] != 0.0:
                    A_hat[i][j] = deg_inv_sqrt[i] * A_tilde[i][j] * deg_inv_sqrt[j]

        return A_hat

    def compute_node_embeddings(self) -> List[List[float]]:
        """
        Forward pass through 2-layer Graph Convolutional Network:
        H^(1) = ReLU(A_hat * X * W_0 + b_0)
        H^(2) = ReLU(A_hat * H^(1) * W_1 + b_1)
        """
        n_nodes = len(self.node_names)
        if n_nodes == 0 or not self.node_features:
            return []

        # Layer 1 Convolution: X_conv = A_hat * X
        X_conv = _mat_mat_mul(self.norm_adj_matrix, self.node_features)
        
        # Linear projection + Bias + ReLU -> H1
        in_dim = len(self.node_features[0])
        h1_dim = len(self.W0[0]) if self.W0 else 0
        H1 = [[0.0] * h1_dim for _ in range(n_nodes)]

        for i in range(n_nodes):
            for j in range(h1_dim):
                s = sum(X_conv[i][k] * self.W0[k][j] for k in range(in_dim)) + self.b0[j]
                H1[i][j] = _relu(s)

        # Layer 2 Convolution: H1_conv = A_hat * H1
        H1_conv = _mat_mat_mul(self.norm_adj_matrix, H1)
        
        # Linear projection + Bias + ReLU -> H2
        embed_dim = len(self.W1[0]) if self.W1 else 0
        H2 = [[0.0] * embed_dim for _ in range(n_nodes)]

        for i in range(n_nodes):
            for j in range(embed_dim):
                s = sum(H1_conv[i][k] * self.W1[k][j] for k in range(h1_dim)) + self.b1[j]
                H2[i][j] = _relu(s)

        return H2

    def get_node_embedding(self, node_name: str) -> List[float]:
        """Get contextual graph embedding for a given node name (with fallback)."""
        embed_dim = len(self.W1[0]) if self.W1 and len(self.W1) > 0 else 8
        if node_name in self.node_to_idx and self.node_embeddings:
            idx = self.node_to_idx[node_name]
            return self.node_embeddings[idx]
        
        # Case-insensitive / substring fallback matching
        name_clean = node_name.lower().replace("_", " ").strip()
        for candidate, idx in self.node_to_idx.items():
            cand_clean = candidate.lower().replace("_", " ").strip()
            if name_clean in cand_clean or cand_clean in name_clean:
                return self.node_embeddings[idx]

        # Default neutral embedding
        return [0.1] * embed_dim

    def encode_tx_features(self, record: Dict[str, Any]) -> List[float]:
        """Normalize transactional / contextual features."""
        vec = []
        for feat in self.tx_feature_names:
            val = record.get(feat, None)
            mean = self.tx_means.get(feat, 0.0)
            std = self.tx_stds.get(feat, 1.0)
            if std <= 0.0:
                std = 1.0

            if val is None:
                numeric_val = mean
            elif isinstance(val, (int, float)):
                numeric_val = float(val)
            elif isinstance(val, str):
                # Categorical encoding mappings
                if feat == "transport_mode":
                    mode_map = {"Road": 1.0, "Rail": 2.0, "Air": 3.0, "Ocean": 4.0}
                    numeric_val = mode_map.get(val, 1.0)
                elif feat == "priority_level":
                    prio_map = {"Standard": 1.0, "High": 2.0, "Urgent": 3.0}
                    numeric_val = prio_map.get(val, 1.0)
                elif feat == "Shipping Mode":
                    ship_map = {"Standard Class": 1.0, "Second Class": 2.0, "First Class": 3.0, "Same Day": 4.0}
                    numeric_val = ship_map.get(val, 1.0)
                else:
                    try:
                        numeric_val = float(val)
                    except ValueError:
                        numeric_val = mean
            else:
                numeric_val = mean

            norm_val = (numeric_val - mean) / std
            vec.append(norm_val)

        return vec

    def predict_risk(
        self,
        origin_node: str,
        dest_node: str,
        category_node: str,
        tx_record: Dict[str, Any]
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Perform end-to-end GCN link risk prediction and structural attribution.
        
        Returns:
            probability: float (0.0 to 1.0)
            attribution: Dict containing decomposed graph risk factors.
        """
        # Retrieve graph embeddings
        h_u = self.get_node_embedding(origin_node)
        h_v = self.get_node_embedding(dest_node)
        h_c = self.get_node_embedding(category_node)
        
        # Transaction features
        x_tx = self.encode_tx_features(tx_record)

        # Concatenate multi-modal input: [h_origin || h_dest || h_category || x_tx]
        z_in = h_u + h_v + h_c + x_tx

        # Readout Hidden Layer: h_readout = ReLU(W_fuse * z_in + b_fuse)
        readout_dim = len(self.b_fuse) if self.b_fuse else 0
        in_dim = len(z_in)
        h_readout = [0.0] * readout_dim

        for i in range(readout_dim):
            s = sum(self.W_fuse[j][i] * z_in[j] for j in range(in_dim)) + self.b_fuse[i]
            h_readout[i] = _relu(s)

        # Output Logit: logit = W_out^T * h_readout + b_out
        logit = self.b_out
        for i in range(readout_dim):
            logit += self.W_out[i][0] * h_readout[i]

        probability = _sigmoid(logit)

        # Calculate structural graph attributions (Gradient / Activation Decomposition)
        embed_len = len(h_u)
        
        # Contribution of Origin Hub vs Destination vs Category vs Transaction Corridors
        origin_contrib = sum(abs(h_u[k]) for k in range(embed_len))
        dest_contrib = sum(abs(h_v[k]) for k in range(embed_len))
        category_contrib = sum(abs(h_c[k]) for k in range(embed_len))
        
        # Breakdown of contextual corridor features
        weather_idx = float(tx_record.get("weather_severity_index", 15.0) or 15.0)
        port_idx = max(
            float(tx_record.get("origin_port_congestion_index", 25.0) or 25.0),
            float(tx_record.get("dest_port_congestion_index", 25.0) or 25.0)
        )
        customs_risk = float(tx_record.get("customs_inspection_risk", 0.2) or 0.2)
        carrier_rel = float(tx_record.get("carrier_reliability_score", 0.85) or 0.85)

        corridor_disruption_impact = (
            (weather_idx / 100.0) * 0.35 +
            (port_idx / 100.0) * 0.35 +
            customs_risk * 0.20 +
            (1.0 - carrier_rel) * 0.10
        )

        total_structural = origin_contrib + dest_contrib + category_contrib + (corridor_disruption_impact * 2.0) + 1e-6
        
        origin_share = round((origin_contrib / total_structural) * 100, 1)
        dest_share = round((dest_contrib / total_structural) * 100, 1)
        cat_share = round((category_contrib / total_structural) * 100, 1)
        corridor_share = round(((corridor_disruption_impact * 2.0) / total_structural) * 100, 1)

        attribution = {
            "origin_hub": {
                "name": origin_node,
                "importance_pct": origin_share,
                "risk_contribution": round(origin_contrib, 3),
                "assessment": "High Hub Dwell" if origin_share > 30 else "Normal Throughput"
            },
            "destination_region": {
                "name": dest_node,
                "importance_pct": dest_share,
                "risk_contribution": round(dest_contrib, 3),
                "assessment": "Congested Corridor" if dest_share > 30 else "Standard Clearance"
            },
            "product_category": {
                "name": category_node,
                "importance_pct": cat_share,
                "risk_contribution": round(category_contrib, 3),
                "assessment": "Fragile/High SLA Sensitivity" if cat_share > 25 else "Standard Cargo"
            },
            "corridor_disruptions": {
                "importance_pct": corridor_share,
                "risk_contribution": round(corridor_disruption_impact, 3),
                "weather_index": weather_idx,
                "port_congestion": port_idx,
                "customs_risk": customs_risk,
                "carrier_reliability": carrier_rel
            },
            "raw_logit": round(logit, 4),
            "graph_propagation_hops": 2
        }

        return round(probability, 4), attribution


def load_gnn_model(model_path: Union[str, Path]) -> SupplyChainGCN:
    """Load trained GCN model from JSON filepath."""
    p = Path(model_path)
    if not p.exists():
        raise FileNotFoundError(f"GNN model file not found at {p.resolve()}")
    with open(p, "r", encoding="utf-8") as f:
        data = json.load(f)
    return SupplyChainGCN(data)
