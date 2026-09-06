"""
Model Training and Evaluation Pipeline for Supply Chain AI Disruption Prediction.

Trains, evaluates, and compares Random Forest vs XGBoost models on the real-world
DataCo Supply Chain dataset (180,519 records).
Optimized for high-precision inference and fast tree construction.
"""

import csv
import json
import math
import os
from pathlib import Path
import random
import time

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

TARGET = "Late_delivery_risk"
SEED = 42


def load_dataco_data(csv_path: Path) -> tuple[list[dict], list[int]]:
    """Load and extract clean pre-delivery predictive features and target from DataCo dataset."""
    rows = []
    y_all = []
    
    with open(csv_path, mode="r", encoding="latin-1") as f:
        reader = csv.DictReader(f)
        for row in reader:
            date_str = row["order date (DateOrders)"]
            try:
                d_part, t_part = date_str.strip().split(" ")
                m, d, y = [int(x) for x in d_part.split("/")]
                h, minute = [int(x) for x in t_part.split(":")]
                import datetime
                dt = datetime.datetime(y, m, d, h, minute)
                order_hour = float(dt.hour)
                order_dayofweek = float(dt.weekday())
                order_month = float(dt.month)
            except Exception:
                order_hour = 12.0
                order_dayofweek = 2.0
                order_month = 6.0

            feat = {
                "Shipping Mode": row["Shipping Mode"].strip(),
                "Type": row["Type"].strip(),
                "Customer Segment": row["Customer Segment"].strip(),
                "Market": row["Market"].strip(),
                "Order Region": row["Order Region"].strip(),
                "Department Name": row["Department Name"].strip(),
                "Days for shipment (scheduled)": float(row["Days for shipment (scheduled)"]),
                "Order Item Product Price": float(row["Order Item Product Price"]),
                "Order Item Quantity": float(row["Order Item Quantity"]),
                "Order Item Discount Rate": float(row["Order Item Discount Rate"]),
                "Order Item Discount": float(row["Order Item Discount"]),
                "Order Item Total": float(row["Order Item Total"]),
                "Order Profit Per Order": float(row["Order Profit Per Order"]),
                "Order Item Profit Ratio": float(row["Order Item Profit Ratio"]),
                "Latitude": float(row["Latitude"]) if row["Latitude"] else 0.0,
                "Longitude": float(row["Longitude"]) if row["Longitude"] else 0.0,
                "order_hour": order_hour,
                "order_dayofweek": order_dayofweek,
                "order_month": order_month,
            }
            rows.append(feat)
            y_all.append(int(row[TARGET]))
            
    return rows, y_all


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
    
    # Fast Wilcoxon / Rank-based ROC-AUC
    pairs = sorted(zip(y_prob, y_true), key=lambda x: x[0])
    n_pos = sum(y_true)
    n_neg = total - n_pos
    
    if n_pos == 0 or n_neg == 0:
        roc_auc = 0.5
        pr_auc = 0.0
    else:
        rank_sum = sum(i + 1 for i, (_, y) in enumerate(pairs) if y == 1)
        roc_auc = (rank_sum - (n_pos * (n_pos + 1)) / 2.0) / (n_pos * n_neg)
        
        # PR-AUC via trapezoidal integration on 50 sampled thresholds
        precisions = []
        recalls = []
        for thresh in [i / 50.0 for i in range(51)]:
            pred_t = [1 if p >= thresh else 0 for p in y_prob]
            tp_t = sum(1 for yt, yp in zip(y_true, pred_t) if yt == 1 and yp == 1)
            fp_t = sum(1 for yt, yp in zip(y_true, pred_t) if yt == 0 and yp == 1)
            p_t = tp_t / (tp_t + fp_t) if (tp_t + fp_t) > 0 else 1.0
            r_t = tp_t / n_pos if n_pos > 0 else 0.0
            precisions.append(p_t)
            recalls.append(r_t)
            
        pr_auc = 0.0
        for i in range(len(recalls) - 1):
            dr = abs(recalls[i] - recalls[i+1])
            avg_p = (precisions[i] + precisions[i+1]) / 2.0
            pr_auc += dr * avg_p
            
    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(min(1.0, pr_auc), 4),
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
        self.feature_names = []
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
                val = row.get(cat, "")
                for cat_val in self.cat_categories[cat]:
                    vec.append(1.0 if val == cat_val else 0.0)
            for num in NUMERICAL_FEATURES:
                val = float(row.get(num, self.num_means[num]))
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


def _build_rf_tree(X, y, depth, max_depth, rng, feature_subsample_size=8, min_samples=15):
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
        vals = [X[i][f_idx] for i in range(0, n, max(1, n // 20))]
        candidates = sorted(set(vals))
        
        for thresh in candidates:
            left_pos = 0
            left_count = 0
            for i in range(n):
                if X[i][f_idx] <= thresh:
                    left_count += 1
                    if y[i] == 1:
                        left_pos += 1
            right_count = n - left_count
            if left_count == 0 or right_count == 0:
                continue
            right_pos = n_pos - left_pos
            p_L = left_pos / left_count
            gini_L = 1.0 - (p_L**2 + (1.0 - p_L)**2)
            p_R = right_pos / right_count
            gini_R = 1.0 - (p_R**2 + (1.0 - p_R)**2)
            
            gain = current_gini - ((left_count / n) * gini_L + (right_count / n) * gini_R)
            if gain > best_gain:
                best_gain = gain
                best_feat = f_idx
                best_thresh = thresh

    if best_gain <= 0.0001 or best_feat is None:
        return PurePythonTree(value=n_pos / n if n > 0 else 0.0)

    left_X = []
    left_y = []
    right_X = []
    right_y = []
    for i in range(n):
        if X[i][best_feat] <= best_thresh:
            left_X.append(X[i])
            left_y.append(y[i])
        else:
            right_X.append(X[i])
            right_y.append(y[i])

    left_child = _build_rf_tree(left_X, left_y, depth + 1, max_depth, rng, feature_subsample_size, min_samples)
    right_child = _build_rf_tree(right_X, right_y, depth + 1, max_depth, rng, feature_subsample_size, min_samples)
    return PurePythonTree(feature_idx=best_feat, threshold=best_thresh, left=left_child, right=right_child)


class PurePythonRandomForest:
    def __init__(self, n_estimators=30, max_depth=6, random_state=42):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.random_state = random_state
        self.trees = []

    def fit(self, X, y, sample_size=4000):
        rng = random.Random(self.random_state)
        n = len(X)
        self.trees = []
        for _ in range(self.n_estimators):
            idx = [rng.randint(0, n - 1) for _ in range(sample_size)]
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


def _build_xgb_tree(X, res, weights, depth, max_depth, rng, min_samples=15):
    n = len(X)
    sum_res = sum(res)
    sum_w = sum(weights)
    if depth >= max_depth or n <= min_samples or sum_w <= 0.0001:
        return PurePythonTree(value=sum_res / (sum_w + 1.0))

    n_feats = len(X[0])
    selected_feats = rng.sample(range(n_feats), min(10, n_feats))
    
    current_score = (sum_res ** 2) / (sum_w + 1.0)
    best_gain = -1
    best_feat = None
    best_thresh = None

    for f_idx in selected_feats:
        vals = [X[i][f_idx] for i in range(0, n, max(1, n // 20))]
        candidates = sorted(set(vals))
        
        for thresh in candidates:
            g_L = 0.0
            h_L = 0.0
            for i in range(n):
                if X[i][f_idx] <= thresh:
                    g_L += res[i]
                    h_L += weights[i]
            g_R = sum_res - g_L
            h_R = sum_w - h_L
            if h_L <= 0.001 or h_R <= 0.001:
                continue
            
            gain = 0.5 * (((g_L**2)/(h_L + 1.0)) + ((g_R**2)/(h_R + 1.0)) - current_score)
            if gain > best_gain:
                best_gain = gain
                best_feat = f_idx
                best_thresh = thresh

    if best_gain <= 0.0001 or best_feat is None:
        return PurePythonTree(value=sum_res / (sum_w + 1.0))

    left_X, left_res, left_w = [], [], []
    right_X, right_res, right_w = [], [], []
    for i in range(n):
        if X[i][best_feat] <= best_thresh:
            left_X.append(X[i])
            left_res.append(res[i])
            left_w.append(weights[i])
        else:
            right_X.append(X[i])
            right_res.append(res[i])
            right_w.append(weights[i])

    left_child = _build_xgb_tree(left_X, left_res, left_w, depth + 1, max_depth, rng, min_samples)
    right_child = _build_xgb_tree(right_X, right_res, right_w, depth + 1, max_depth, rng, min_samples)
    return PurePythonTree(feature_idx=best_feat, threshold=best_thresh, left=left_child, right=right_child)


class PurePythonXGBoost:
    def __init__(self, n_estimators=35, max_depth=5, learning_rate=0.25, scale_pos_weight=1.0, random_state=42):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.scale_pos_weight = scale_pos_weight
        self.random_state = random_state
        self.base_score = 0.0
        self.trees = []

    def fit(self, X, y, sample_size=5000):
        rng = random.Random(self.random_state)
        n = len(X)
        p_base = sum(y) / len(y)
        self.base_score = math.log(p_base / (1.0 - p_base)) if 0 < p_base < 1 else 0.0
        F = [self.base_score] * n
        self.trees = []

        for _ in range(self.n_estimators):
            sub_idx = [rng.randint(0, n - 1) for _ in range(sample_size)]
            sub_X = [X[i] for i in sub_idx]
            sub_y = [y[i] for i in sub_idx]
            sub_F = [F[i] for i in sub_idx]

            p = [1.0 / (1.0 + math.exp(-max(-12, min(12, f)))) for f in sub_F]
            residuals = []
            weights = []
            for y_true, p_pred in zip(sub_y, p):
                w = self.scale_pos_weight if y_true == 1 else 1.0
                g = w * (y_true - p_pred)
                h = w * p_pred * (1.0 - p_pred)
                residuals.append(g)
                weights.append(h)

            tree = _build_xgb_tree(sub_X, residuals, weights, 0, self.max_depth, rng)
            self.trees.append(tree)

            for i in range(n):
                update = self._eval_tree(tree, X[i])
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
    raw_csv = data_dir / "raw" / "DataCoSupplyChainDataset.csv"
    models_dir = base_dir / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 75)
    print("DATACO SUPPLY CHAIN DISRUPTION RISK ML TRAINING PIPELINE")
    print(f"Dataset Path: {raw_csv}")
    print("=" * 75)

    if not raw_csv.exists():
        raise FileNotFoundError(f"DataCo dataset not found at {raw_csv}")

    rows, y_all = load_dataco_data(raw_csv)
    n_total = len(rows)
    n_pos = sum(y_all)
    n_neg = n_total - n_pos

    print(f"Loaded Total Records: {n_total}")
    print(f"Target Distribution: Class 0 (On-time) = {n_neg} ({n_neg/n_total*100:.2f}%), Class 1 (Late) = {n_pos} ({n_pos/n_total*100:.2f}%)")

    # Stratified 70 / 15 / 15 Split
    rng = random.Random(SEED)
    idx_0 = [i for i, y in enumerate(y_all) if y == 0]
    idx_1 = [i for i, y in enumerate(y_all) if y == 1]
    rng.shuffle(idx_0)
    rng.shuffle(idx_1)

    n0, n1 = len(idx_0), len(idx_1)
    train_idx = idx_0[:int(0.70 * n0)] + idx_1[:int(0.70 * n1)]
    val_idx = idx_0[int(0.70 * n0):int(0.85 * n0)] + idx_1[int(0.70 * n1):int(0.85 * n1)]
    test_idx = idx_0[int(0.85 * n0):] + idx_1[int(0.85 * n1):]

    rng.shuffle(train_idx)
    rng.shuffle(val_idx)
    rng.shuffle(test_idx)

    X_train_raw = [rows[i] for i in train_idx]
    y_train = [y_all[i] for i in train_idx]

    X_val_raw = [rows[i] for i in val_idx]
    y_val = [y_all[i] for i in val_idx]

    X_test_raw = [rows[i] for i in test_idx]
    y_test = [y_all[i] for i in test_idx]

    print("-" * 75)
    print(f"Train Set: {len(X_train_raw)} | Val Set: {len(X_val_raw)} | Test Set: {len(X_test_raw)}")
    print("-" * 75)

    preprocessor = PurePythonPreprocessor()
    preprocessor.fit(X_train_raw)

    X_train = preprocessor.transform(X_train_raw)
    X_val = preprocessor.transform(X_val_raw)
    X_test = preprocessor.transform(X_test_raw)

    print(f"Extracted Features: {len(CATEGORICAL_FEATURES)} Categorical, {len(NUMERICAL_FEATURES)} Numerical")
    print(f"Total One-Hot Encoded Features: {len(preprocessor.feature_names)}")
    print("-" * 75)

    # 1. Train Random Forest
    print("Training Random Forest ensemble...")
    t0_rf = time.time()
    rf = PurePythonRandomForest(n_estimators=30, max_depth=6, random_state=SEED)
    rf.fit(X_train, y_train, sample_size=4000)
    rf_time = time.time() - t0_rf
    print(f"Random Forest trained in {rf_time:.2f}s")

    rf_val_prob = rf.predict_proba(X_val)
    rf_test_prob = rf.predict_proba(X_test)
    rf_val_metrics = calculate_classification_metrics(y_val, rf_val_prob)
    rf_test_metrics = calculate_classification_metrics(y_test, rf_test_prob)

    # 2. Train XGBoost
    print("Training XGBoost boosted tree ensemble...")
    t0_xgb = time.time()
    xgb_model = PurePythonXGBoost(n_estimators=35, max_depth=5, learning_rate=0.25, scale_pos_weight=1.0, random_state=SEED)
    xgb_model.fit(X_train, y_train, sample_size=5000)
    xgb_time = time.time() - t0_xgb
    print(f"XGBoost trained in {xgb_time:.2f}s")

    xgb_val_prob = xgb_model.predict_proba(X_val)
    xgb_test_prob = xgb_model.predict_proba(X_test)
    xgb_val_metrics = calculate_classification_metrics(y_val, xgb_val_prob)
    xgb_test_metrics = calculate_classification_metrics(y_test, xgb_test_prob)

    xgb_score = xgb_test_metrics["f1_score"] + xgb_test_metrics["roc_auc"] + xgb_test_metrics["accuracy"]
    rf_score = rf_test_metrics["f1_score"] + rf_test_metrics["roc_auc"] + rf_test_metrics["accuracy"]
    primary_model = "XGBoost" if xgb_score >= rf_score else "Random Forest"

    metadata = {
        "dataset_name": "DataCo Supply Chain Dataset",
        "total_records": n_total,
        "training_dataset_size": len(X_train),
        "validation_dataset_size": len(X_val),
        "test_dataset_size": len(X_test),
        "features": {
            "categorical": CATEGORICAL_FEATURES,
            "numerical": NUMERICAL_FEATURES,
            "encoded_feature_names": preprocessor.feature_names,
        },
        "target": TARGET,
        "target_classes": {"0": "On-time", "1": "Late"},
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

    print("=" * 75)
    print("MODEL EVALUATION RESULTS (TEST SET):")
    print("=" * 75)
    print("XGBOOST METRICS:")
    print(f"  Accuracy:  {xgb_test_metrics['accuracy']:.4f}")
    print(f"  Precision: {xgb_test_metrics['precision']:.4f}")
    print(f"  Recall:    {xgb_test_metrics['recall']:.4f}")
    print(f"  F1-Score:  {xgb_test_metrics['f1_score']:.4f}")
    print(f"  ROC-AUC:   {xgb_test_metrics['roc_auc']:.4f}")
    print(f"  PR-AUC:    {xgb_test_metrics['pr_auc']:.4f}")
    print(f"  Confusion Matrix: TN={xgb_test_metrics['confusion_matrix']['tn']}, FP={xgb_test_metrics['confusion_matrix']['fp']}, FN={xgb_test_metrics['confusion_matrix']['fn']}, TP={xgb_test_metrics['confusion_matrix']['tp']}")
    print("-" * 75)
    print("RANDOM FOREST METRICS:")
    print(f"  Accuracy:  {rf_test_metrics['accuracy']:.4f}")
    print(f"  Precision: {rf_test_metrics['precision']:.4f}")
    print(f"  Recall:    {rf_test_metrics['recall']:.4f}")
    print(f"  F1-Score:  {rf_test_metrics['f1_score']:.4f}")
    print(f"  ROC-AUC:   {rf_test_metrics['roc_auc']:.4f}")
    print(f"  PR-AUC:    {rf_test_metrics['pr_auc']:.4f}")
    print(f"  Confusion Matrix: TN={rf_test_metrics['confusion_matrix']['tn']}, FP={rf_test_metrics['confusion_matrix']['fp']}, FN={rf_test_metrics['confusion_matrix']['fn']}, TP={rf_test_metrics['confusion_matrix']['tp']}")
    print("=" * 75)
    print(f"SELECTED PRIMARY MODEL: {primary_model}")
    print(f"Artifacts successfully saved to: {models_dir}")
    print("=" * 75)

    return metadata


if __name__ == "__main__":
    train_and_evaluate_all()
