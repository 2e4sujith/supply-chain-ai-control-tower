"""
Model Training and Evaluation Pipeline for Supply Chain AI Disruption Prediction.

Trains, evaluates, and compares Random Forest vs XGBoost models on the stratified
synthetic supply chain dataset. Saves trained model artifacts and metadata.
"""

import csv
import json
import math
import os
from pathlib import Path
import random
import time

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

TARGET = "disrupted"
SEED = 42


def load_csv_data(filepath: Path) -> tuple[list[dict], list[int]]:
    X_rows = []
    y_vals = []
    with open(filepath, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            feat = {k: row[k] for k in CATEGORICAL_FEATURES}
            for k in NUMERICAL_FEATURES:
                feat[k] = float(row[k])
            X_rows.append(feat)
            y_vals.append(int(row[TARGET]))
    return X_rows, y_vals


def calculate_classification_metrics(y_true: list[int], y_prob: list[float], threshold: float = 0.50) -> dict:
    y_pred = [1 if p >= threshold else 0 for p in y_prob]
    
    tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
    tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)
    fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
    fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)
    
    total = len(y_true)
    accuracy = (tp + tn) / total if total > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    
    pairs = sorted(zip(y_prob, y_true), key=lambda x: x[0])
    n_pos = sum(y_true)
    n_neg = total - n_pos
    
    if n_pos == 0 or n_neg == 0:
        roc_auc = 0.5
        pr_auc = 0.0
    else:
        rank_sum = sum(i + 1 for i, (_, y) in enumerate(pairs) if y == 1)
        roc_auc = (rank_sum - (n_pos * (n_pos + 1)) / 2.0) / (n_pos * n_neg)
        
        pairs_desc = sorted(zip(y_prob, y_true), key=lambda x: x[0], reverse=True)
        cum_tp = 0
        cum_fp = 0
        precisions = []
        recalls = []
        for p, y in pairs_desc:
            if y == 1:
                cum_tp += 1
            else:
                cum_fp += 1
            recalls.append(cum_tp / n_pos)
            precisions.append(cum_tp / (cum_tp + cum_fp))
            
        pr_auc = 0.0
        prev_r = 0.0
        for r, prec in zip(recalls, precisions):
            pr_auc += (r - prev_r) * prec
            prev_r = r
            
    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "confusion_matrix": {
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "tp": tp,
        }
    }


class PurePythonPreprocessor:
    def __init__(self):
        self.cat_categories = {}
        self.num_means = {}
        self.num_stds = {}
        self.feature_names = []

    def fit(self, X: list[dict]):
        for cat in CATEGORICAL_FEATURES:
            vals = sorted(list(set(row[cat] for row in X)))
            self.cat_categories[cat] = vals
            for v in vals:
                self.feature_names.append(f"{cat}_{v}")

        for num in NUMERICAL_FEATURES:
            vals = [row[num] for row in X]
            mean = sum(vals) / len(vals)
            var = sum((v - mean) ** 2 for v in vals) / len(vals)
            std = math.sqrt(var) if var > 0 else 1.0
            self.num_means[num] = mean
            self.num_stds[num] = std
            self.feature_names.append(num)

    def transform(self, X: list[dict]) -> list[list[float]]:
        transformed = []
        for row in X:
            vec = []
            for cat in CATEGORICAL_FEATURES:
                val = row[cat]
                for cat_val in self.cat_categories[cat]:
                    vec.append(1.0 if val == cat_val else 0.0)
            for num in NUMERICAL_FEATURES:
                val = row[num]
                norm_val = (val - self.num_means[num]) / self.num_stds[num]
                vec.append(norm_val)
            transformed.append(vec)
        return transformed


class PurePythonTree:
    def __init__(self, feature_idx=None, threshold=None, left=None, right=None, value=None):
        self.feature_idx = feature_idx
        self.threshold = threshold
        self.left = left
        self.right = right
        self.value = value

    def is_leaf(self):
        return self.value is not None


def _build_rf_tree(X, y, depth, max_depth, rng, feature_subsample_size=6, min_samples=6):
    n = len(X)
    n_pos = sum(y)
    if depth >= max_depth or n <= min_samples or n_pos == 0 or n_pos == n:
        return PurePythonTree(value=n_pos / n if n > 0 else 0.0)

    n_feats = len(X[0])
    selected_feats = rng.sample(range(n_feats), min(feature_subsample_size, n_feats))
    
    best_gain = -1
    best_feat = None
    best_thresh = None
    
    p1 = n_pos / n
    current_gini = 1.0 - (p1**2 + (1.0 - p1)**2)

    for f_idx in selected_feats:
        vals = [row[f_idx] for row in X]
        sorted_vals = sorted(vals)
        step = max(1, n // 5)
        candidates = [sorted_vals[i] for i in range(step, n, step)][:4]
        
        for thresh in candidates:
            left_y = [y[i] for i, row in enumerate(X) if row[f_idx] <= thresh]
            n_L = len(left_y)
            n_R = n - n_L
            if n_L == 0 or n_R == 0:
                continue
            p_L = sum(left_y) / n_L
            gini_L = 1.0 - (p_L**2 + (1.0 - p_L)**2)
            p_R = (n_pos - sum(left_y)) / n_R
            gini_R = 1.0 - (p_R**2 + (1.0 - p_R)**2)
            
            gain = current_gini - ((n_L / n) * gini_L + (n_R / n) * gini_R)
            if gain > best_gain:
                best_gain = gain
                best_feat = f_idx
                best_thresh = thresh

    if best_gain <= 0.0001 or best_feat is None:
        return PurePythonTree(value=n_pos / n if n > 0 else 0.0)

    left_X = [row for row in X if row[best_feat] <= best_thresh]
    left_y = [y[i] for i, row in enumerate(X) if row[best_feat] <= best_thresh]
    right_X = [row for row in X if row[best_feat] > best_thresh]
    right_y = [y[i] for i, row in enumerate(X) if row[best_feat] > best_thresh]

    left_child = _build_rf_tree(left_X, left_y, depth + 1, max_depth, rng, feature_subsample_size, min_samples)
    right_child = _build_rf_tree(right_X, right_y, depth + 1, max_depth, rng, feature_subsample_size, min_samples)
    return PurePythonTree(feature_idx=best_feat, threshold=best_thresh, left=left_child, right=right_child)


class PurePythonRandomForest:
    def __init__(self, n_estimators=35, max_depth=6, random_state=42):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.random_state = random_state
        self.trees = []

    def fit(self, X, y):
        rng = random.Random(self.random_state)
        n = len(X)
        self.trees = []
        for _ in range(self.n_estimators):
            idx = [rng.randint(0, n - 1) for _ in range(n)]
            boot_X = [X[i] for i in idx]
            boot_y = [y[i] for i in idx]
            tree = _build_rf_tree(boot_X, boot_y, 0, self.max_depth, rng)
            self.trees.append(tree)

    def _eval_tree(self, tree, x):
        if tree.is_leaf():
            return tree.value
        if x[tree.feature_idx] <= tree.threshold:
            return self._eval_tree(tree.left, x)
        return self._eval_tree(tree.right, x)

    def predict_proba(self, X):
        return [sum(self._eval_tree(t, x) for t in self.trees) / len(self.trees) for x in X]


def _build_xgb_tree(X, res, weights, depth, max_depth, rng, min_samples=6):
    n = len(X)
    sum_res = sum(res)
    sum_w = sum(weights)
    if depth >= max_depth or n <= min_samples or sum_w <= 0.0001:
        return PurePythonTree(value=sum_res / (sum_w + 1.0))

    n_feats = len(X[0])
    selected_feats = rng.sample(range(n_feats), min(8, n_feats))
    
    current_score = (sum_res ** 2) / (sum_w + 1.0)
    best_gain = -1
    best_feat = None
    best_thresh = None

    for f_idx in selected_feats:
        vals = [row[f_idx] for row in X]
        sorted_vals = sorted(vals)
        step = max(1, n // 6)
        candidates = [sorted_vals[i] for i in range(step, n, step)][:5]
        
        for thresh in candidates:
            left_idx = [i for i, row in enumerate(X) if row[f_idx] <= thresh]
            right_idx = [i for i, row in enumerate(X) if row[f_idx] > thresh]
            if not left_idx or not right_idx:
                continue
            g_L = sum(res[i] for i in left_idx)
            h_L = sum(weights[i] for i in left_idx)
            g_R = sum_res - g_L
            h_R = sum_w - h_L
            
            gain = 0.5 * (((g_L**2)/(h_L + 1.0)) + ((g_R**2)/(h_R + 1.0)) - current_score)
            if gain > best_gain:
                best_gain = gain
                best_feat = f_idx
                best_thresh = thresh

    if best_gain <= 0.0001 or best_feat is None:
        return PurePythonTree(value=sum_res / (sum_w + 1.0))

    left_X = [row for row in X if row[best_feat] <= best_thresh]
    left_res = [res[i] for i, row in enumerate(X) if row[best_feat] <= best_thresh]
    left_w = [weights[i] for i, row in enumerate(X) if row[best_feat] <= best_thresh]

    right_X = [row for row in X if row[best_feat] > best_thresh]
    right_res = [res[i] for i, row in enumerate(X) if row[best_feat] > best_thresh]
    right_w = [weights[i] for i, row in enumerate(X) if row[best_feat] > best_thresh]

    left_child = _build_xgb_tree(left_X, left_res, left_w, depth + 1, max_depth, rng, min_samples)
    right_child = _build_xgb_tree(right_X, right_res, right_w, depth + 1, max_depth, rng, min_samples)
    return PurePythonTree(feature_idx=best_feat, threshold=best_thresh, left=left_child, right=right_child)


class PurePythonXGBoost:
    def __init__(self, n_estimators=35, max_depth=4, learning_rate=0.15, scale_pos_weight=3.2, random_state=42):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.scale_pos_weight = scale_pos_weight
        self.random_state = random_state
        self.base_score = 0.0
        self.trees = []

    def fit(self, X, y):
        rng = random.Random(self.random_state)
        p_base = sum(y) / len(y)
        self.base_score = math.log(p_base / (1.0 - p_base)) if 0 < p_base < 1 else 0.0
        F = [self.base_score] * len(X)
        self.trees = []

        for _ in range(self.n_estimators):
            p = [1.0 / (1.0 + math.exp(-max(-12, min(12, f)))) for f in F]
            residuals = []
            weights = []
            for y_true, p_pred in zip(y, p):
                w = self.scale_pos_weight if y_true == 1 else 1.0
                g = w * (y_true - p_pred)
                h = w * p_pred * (1.0 - p_pred)
                residuals.append(g)
                weights.append(h)

            tree = _build_xgb_tree(X, residuals, weights, 0, self.max_depth, rng)
            self.trees.append(tree)

            for i, x in enumerate(X):
                update = self._eval_tree(tree, x)
                F[i] += self.learning_rate * update

    def _eval_tree(self, tree, x):
        if tree.is_leaf():
            return tree.value
        if x[tree.feature_idx] <= tree.threshold:
            return self._eval_tree(tree.left, x)
        return self._eval_tree(tree.right, x)

    def predict_proba(self, X):
        probs = []
        for x in X:
            score = self.base_score
            for t in self.trees:
                score += self.learning_rate * self._eval_tree(t, x)
            score = max(-12, min(12, score))
            probs.append(1.0 / (1.0 + math.exp(-score)))
        return probs


def train_and_evaluate_all(base_dir: Path | None = None) -> dict:
    if base_dir is None:
        try:
            base_dir = Path(__file__).resolve().parent.parent
        except NameError:
            base_dir = Path.cwd()
            if base_dir.name != "backend" and (base_dir / "backend").exists():
                base_dir = base_dir / "backend"

    data_dir = base_dir / "data"
    models_dir = base_dir / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    X_train_raw, y_train = load_csv_data(data_dir / "train.csv")
    X_val_raw, y_val = load_csv_data(data_dir / "validation.csv")
    X_test_raw, y_test = load_csv_data(data_dir / "test.csv")

    preprocessor = PurePythonPreprocessor()
    preprocessor.fit(X_train_raw)

    X_train = preprocessor.transform(X_train_raw)
    X_val = preprocessor.transform(X_val_raw)
    X_test = preprocessor.transform(X_test_raw)

    print("=" * 70)
    print("TRAINING MODELS: RANDOM FOREST vs. XGBOOST")
    print("=" * 70)
    print(f"Training Samples:   {len(X_train)} (Positive: {sum(y_train)}, Negative: {len(y_train) - sum(y_train)})")
    print(f"Validation Samples: {len(X_val)} (Positive: {sum(y_val)}, Negative: {len(y_val) - sum(y_val)})")
    print(f"Test Samples:       {len(X_test)} (Positive: {sum(y_test)}, Negative: {len(y_test) - sum(y_test)})")
    print("-" * 70)

    # 1. Train Random Forest
    rf = PurePythonRandomForest(n_estimators=35, max_depth=6, random_state=42)
    rf.fit(X_train, y_train)

    rf_val_prob = rf.predict_proba(X_val)
    rf_test_prob = rf.predict_proba(X_test)

    rf_val_metrics = calculate_classification_metrics(y_val, rf_val_prob)
    rf_test_metrics = calculate_classification_metrics(y_test, rf_test_prob)

    # 2. Train XGBoost
    xgb_model = PurePythonXGBoost(n_estimators=35, max_depth=4, learning_rate=0.15, scale_pos_weight=3.2, random_state=42)
    xgb_model.fit(X_train, y_train)

    xgb_val_prob = xgb_model.predict_proba(X_val)
    xgb_test_prob = xgb_model.predict_proba(X_test)

    xgb_val_metrics = calculate_classification_metrics(y_val, xgb_val_prob)
    xgb_test_metrics = calculate_classification_metrics(y_test, xgb_test_prob)

    # Determine Winner
    xgb_score = xgb_test_metrics["f1_score"] + xgb_test_metrics["roc_auc"] + xgb_test_metrics["recall"]
    rf_score = rf_test_metrics["f1_score"] + rf_test_metrics["roc_auc"] + rf_test_metrics["recall"]
    primary_model = "XGBoost" if xgb_score >= rf_score else "Random Forest"

    metadata = {
        "training_dataset_size": len(X_train),
        "validation_dataset_size": len(X_val),
        "test_dataset_size": len(X_test),
        "features": {
            "categorical": CATEGORICAL_FEATURES,
            "numerical": NUMERICAL_FEATURES,
            "encoded_feature_names": preprocessor.feature_names,
        },
        "target": TARGET,
        "training_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "random_seed": SEED,
        "selected_primary_model": primary_model,
        "metrics": {
            "random_forest": {
                "validation": rf_val_metrics,
                "test": rf_test_metrics,
            },
            "xgboost": {
                "validation": xgb_val_metrics,
                "test": xgb_test_metrics,
            },
        },
    }

    # Save metadata
    with open(models_dir / "model_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # Save Preprocessor Artifact
    prep_data = {
        "cat_categories": preprocessor.cat_categories,
        "num_means": preprocessor.num_means,
        "num_stds": preprocessor.num_stds,
        "feature_names": preprocessor.feature_names,
    }
    with open(models_dir / "preprocessor.json", "w", encoding="utf-8") as f:
        json.dump(prep_data, f, indent=2)

    def serialize_tree(node):
        if node.is_leaf():
            return {"value": node.value}
        return {
            "feature_idx": node.feature_idx,
            "threshold": node.threshold,
            "left": serialize_tree(node.left),
            "right": serialize_tree(node.right),
        }

    # Save RF
    rf_data = {
        "n_estimators": rf.n_estimators,
        "trees": [serialize_tree(t) for t in rf.trees],
    }
    with open(models_dir / "random_forest.json", "w", encoding="utf-8") as f:
        json.dump(rf_data, f)

    # Save XGB
    xgb_data = {
        "base_score": xgb_model.base_score,
        "learning_rate": xgb_model.learning_rate,
        "trees": [serialize_tree(t) for t in xgb_model.trees],
    }
    with open(models_dir / "xgboost.json", "w", encoding="utf-8") as f:
        json.dump(xgb_data, f)

    print("RANDOM FOREST RESULTS:")
    print(f"  Validation -> Accuracy: {rf_val_metrics['accuracy']}, Recall: {rf_val_metrics['recall']}, F1: {rf_val_metrics['f1_score']}, ROC-AUC: {rf_val_metrics['roc_auc']}, PR-AUC: {rf_val_metrics['pr_auc']}")
    print(f"  Test       -> Accuracy: {rf_test_metrics['accuracy']}, Recall: {rf_test_metrics['recall']}, F1: {rf_test_metrics['f1_score']}, ROC-AUC: {rf_test_metrics['roc_auc']}, PR-AUC: {rf_test_metrics['pr_auc']}")
    print(f"  Confusion Matrix (Test): TN={rf_test_metrics['confusion_matrix']['tn']}, FP={rf_test_metrics['confusion_matrix']['fp']}, FN={rf_test_metrics['confusion_matrix']['fn']}, TP={rf_test_metrics['confusion_matrix']['tp']}")
    print("-" * 70)
    print("XGBOOST RESULTS:")
    print(f"  Validation -> Accuracy: {xgb_val_metrics['accuracy']}, Recall: {xgb_val_metrics['recall']}, F1: {xgb_val_metrics['f1_score']}, ROC-AUC: {xgb_val_metrics['roc_auc']}, PR-AUC: {xgb_val_metrics['pr_auc']}")
    print(f"  Test       -> Accuracy: {xgb_test_metrics['accuracy']}, Recall: {xgb_test_metrics['recall']}, F1: {xgb_test_metrics['f1_score']}, ROC-AUC: {xgb_test_metrics['roc_auc']}, PR-AUC: {xgb_test_metrics['pr_auc']}")
    print(f"  Confusion Matrix (Test): TN={xgb_test_metrics['confusion_matrix']['tn']}, FP={xgb_test_metrics['confusion_matrix']['fp']}, FN={xgb_test_metrics['confusion_matrix']['fn']}, TP={xgb_test_metrics['confusion_matrix']['tp']}")
    print("-" * 70)
    print(f"RECOMMENDED PRIMARY MODEL: {primary_model}")
    print(f"Model artifacts and metadata successfully saved to: {models_dir}")
    print("=" * 70)
    return metadata


if __name__ == "__main__":
    train_and_evaluate_all()
