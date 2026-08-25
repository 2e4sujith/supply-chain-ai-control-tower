"""
Standalone Synthetic Historical Shipment Dataset Generator for Supply Chain AI.
"""

import csv
import math
from pathlib import Path
import random

SEED = 42
TOTAL_RECORDS = 5000
TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
TEST_RATIO = 0.15

TRANSPORT_MODES = ["Ocean", "Air", "Road", "Rail"]
ORIGIN_REGIONS = [
    "East_Asia",
    "South_Asia",
    "Southeast_Asia",
    "Europe",
    "North_America",
    "Latin_America",
    "Middle_East",
]
DESTINATION_REGIONS = [
    "North_America",
    "Europe",
    "East_Asia",
    "Latin_America",
    "Middle_East",
    "Oceania",
]
PRIORITY_LEVELS = ["Standard", "High", "Urgent"]

FIELDNAMES = [
    "transport_mode",
    "origin_region",
    "destination_region",
    "route_distance_km",
    "planned_duration_hours",
    "elapsed_transit_hours",
    "transit_progress_pct",
    "priority_level",
    "carrier_reliability_score",
    "origin_port_congestion_index",
    "dest_port_congestion_index",
    "weather_severity_index",
    "customs_inspection_risk",
    "seasonal_disruption_factor",
    "disrupted",
]


def generate_dataset():
    random.seed(SEED)
    records = []
    
    for _ in range(TOTAL_RECORDS):
        mode = random.choices(TRANSPORT_MODES, weights=[0.40, 0.20, 0.25, 0.15])[0]
        
        if mode == "Ocean":
            origin = random.choice(["East_Asia", "Southeast_Asia", "South_Asia", "Europe"])
            dest = random.choice(["North_America", "Europe", "Latin_America", "Oceania", "Middle_East"])
            dist = max(3500.0, min(22000.0, random.gauss(11200, 3200)))
            buffer = random.uniform(36.0, 96.0)
            duration = (dist / 32.0) + buffer
        elif mode == "Air":
            origin = random.choice(ORIGIN_REGIONS)
            dest = random.choice([r for r in DESTINATION_REGIONS if r != origin] or DESTINATION_REGIONS)
            dist = max(1200.0, min(15000.0, random.gauss(6800, 2400)))
            buffer = random.uniform(12.0, 36.0)
            duration = (dist / 750.0) + buffer
        elif mode == "Road":
            origin = random.choice(["North_America", "Europe", "Latin_America", "East_Asia"])
            dest = origin if random.random() < 0.70 else random.choice(["North_America", "Europe", "Latin_America"])
            dist = max(150.0, min(3800.0, random.gauss(1250, 580)))
            buffer = random.uniform(4.0, 16.0)
            duration = (dist / 70.0) + buffer
        else:  # Rail
            origin = random.choice(["East_Asia", "Europe", "North_America", "South_Asia"])
            dest = origin if random.random() < 0.60 else random.choice(["Europe", "East_Asia", "North_America"])
            dist = max(500.0, min(9500.0, random.gauss(3400, 1400)))
            buffer = random.uniform(12.0, 48.0)
            duration = (dist / 50.0) + buffer

        dist = round(dist, 1)
        duration = round(duration, 1)
        progress_factor = random.uniform(0.05, 0.98)
        elapsed = round(duration * progress_factor, 1)
        progress_pct = round(min(1.0, max(0.0, elapsed / duration)), 4)
        priority = random.choices(PRIORITY_LEVELS, weights=[0.60, 0.28, 0.12])[0]
        carrier_rel = round(max(0.12, min(0.99, random.gauss(0.85, 0.12))), 4)
        orig_cong = round(max(0.0, min(100.0, random.gammavariate(3.0, 12.0))), 1)
        dest_cong = round(max(0.0, min(100.0, random.gammavariate(3.0, 12.0))), 1)
        weather = round(max(0.0, min(100.0, random.gammavariate(2.5, 11.0))), 1)
        
        if origin != dest:
            customs = round(max(0.05, min(0.98, random.gauss(0.42, 0.18))), 4)
        else:
            customs = round(max(0.02, min(0.45, random.gauss(0.12, 0.06))), 4)
            
        seasonal = round(max(0.05, min(0.98, random.uniform(0.05, 0.98))), 4)

        z = (
            -2.90
            + 2.85 * (1.0 - carrier_rel)
            + 2.25 * (orig_cong / 100.0)
            + 2.05 * (dest_cong / 100.0)
            + 2.75 * (weather / 100.0)
            + 1.65 * customs
            + 1.35 * seasonal
            + 0.85 * (dist / 10000.0)
            + random.gauss(0, 0.38)
        )
        
        if mode == "Ocean" and weather > 60.0:
            z += 0.70
        if mode == "Air" and weather > 70.0:
            z += 0.85
        if mode == "Road" and orig_cong > 65.0:
            z += 0.55
        if priority == "Urgent" and carrier_rel < 0.70:
            z += 0.65
        if origin != dest and customs > 0.60:
            z += 0.40

        prob = 1.0 / (1.0 + math.exp(-z))
        disrupted = 1 if prob >= 0.50 else 0

        records.append({
            "transport_mode": mode,
            "origin_region": origin,
            "destination_region": dest,
            "route_distance_km": dist,
            "planned_duration_hours": duration,
            "elapsed_transit_hours": elapsed,
            "transit_progress_pct": progress_pct,
            "priority_level": priority,
            "carrier_reliability_score": carrier_rel,
            "origin_port_congestion_index": orig_cong,
            "dest_port_congestion_index": dest_cong,
            "weather_severity_index": weather,
            "customs_inspection_risk": customs,
            "seasonal_disruption_factor": seasonal,
            "disrupted": disrupted,
        })
        
    disrupted_recs = [r for r in records if r["disrupted"] == 1]
    non_disrupted_recs = [r for r in records if r["disrupted"] == 0]
    
    random.shuffle(disrupted_recs)
    random.shuffle(non_disrupted_recs)
    
    train_d_count = int(round(len(disrupted_recs) * TRAIN_RATIO))
    val_d_count = int(round(len(disrupted_recs) * VAL_RATIO))
    test_d_count = len(disrupted_recs) - train_d_count - val_d_count

    train_nd_count = 3500 - train_d_count
    val_nd_count = 750 - val_d_count
    test_nd_count = len(non_disrupted_recs) - train_nd_count - val_nd_count

    train_set = disrupted_recs[:train_d_count] + non_disrupted_recs[:train_nd_count]
    val_set = (
        disrupted_recs[train_d_count:train_d_count + val_d_count]
        + non_disrupted_recs[train_nd_count:train_nd_count + val_nd_count]
    )
    test_set = (
        disrupted_recs[train_d_count + val_d_count:]
        + non_disrupted_recs[train_nd_count + val_nd_count:]
    )

    random.shuffle(train_set)
    random.shuffle(val_set)
    random.shuffle(test_set)
    
    for r in train_set:
        r["split"] = "train"
    for r in val_set:
        r["split"] = "validation"
    for r in test_set:
        r["split"] = "test"
        
    full = train_set + val_set + test_set
    
    base_dir = Path(__file__).resolve().parent.parent
    data_dir = base_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    
    def write_csv(path: Path, data: list[dict], include_split: bool = False):
        fieldnames = FIELDNAMES + (["split"] if include_split else [])
        with open(path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in data:
                row_copy = {k: row[k] for k in fieldnames}
                writer.writerow(row_copy)
                
    write_csv(data_dir / "supply_chain_dataset.csv", full, include_split=True)
    write_csv(data_dir / "train.csv", train_set, include_split=False)
    write_csv(data_dir / "validation.csv", val_set, include_split=False)
    write_csv(data_dir / "test.csv", test_set, include_split=False)
    
    disrupted_total = sum(1 for r in full if r["disrupted"] == 1)
    train_d = sum(1 for r in train_set if r["disrupted"] == 1)
    val_d = sum(1 for r in val_set if r["disrupted"] == 1)
    test_d = sum(1 for r in test_set if r["disrupted"] == 1)

    print("=" * 70)
    print("SUPPLY CHAIN SYNTHETIC DATASET GENERATION REPORT")
    print("=" * 70)
    print(f"Total Rows Generated : {len(full)}")
    print(f"Number of Features   : {len(FIELDNAMES) - 1} operational features + target ('disrupted') + 'split'")
    print(f"\nTarget Class Distribution ('disrupted'):")
    print(f"  Class 0 (Non-Disrupted): {len(full) - disrupted_total} ({(len(full) - disrupted_total)/len(full)*100:.2f}%)")
    print(f"  Class 1 (Disrupted)    : {disrupted_total} ({disrupted_total/len(full)*100:.2f}%)")
    print(f"\nStratified Split Summary:")
    print(f"  Train Split      : {len(train_set)} rows | Disrupted: {train_d} ({train_d/len(train_set)*100:.2f}%) | Non-Disrupted: {len(train_set)-train_d} ({(len(train_set)-train_d)/len(train_set)*100:.2f}%)")
    print(f"  Validation Split : {len(val_set)} rows | Disrupted: {val_d} ({val_d/len(val_set)*100:.2f}%) | Non-Disrupted: {len(val_set)-val_d} ({(len(val_set)-val_d)/len(val_set)*100:.2f}%)")
    print(f"  Test Split       : {len(test_set)} rows | Disrupted: {test_d} ({test_d/len(test_set)*100:.2f}%) | Non-Disrupted: {len(test_set)-test_d} ({(len(test_set)-test_d)/len(test_set)*100:.2f}%)")

    num_fields = [
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

    print("\nNumerical Feature Summary Statistics (Min / Mean / Max):")
    print(f"{'Feature Name':<32} | {'Min':>10} | {'Mean':>10} | {'Max':>10}")
    print("-" * 70)
    for feat in num_fields:
        vals = [r[feat] for r in full]
        min_v, max_v, mean_v = min(vals), max(vals), sum(vals) / len(vals)
        print(f"{feat:<32} | {min_v:>10.2f} | {mean_v:>10.2f} | {max_v:>10.2f}")

    print("=" * 70)


if __name__ == "__main__":
    generate_dataset()
