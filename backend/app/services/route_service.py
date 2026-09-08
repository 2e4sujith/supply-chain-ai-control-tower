"""
Route Service and Supply Chain Route Network Foundation using NetworkX.

Builds a multimodal directed graph representing global supply chain logistics hubs,
ports, airports, intermodal rail terminals, and transit corridors.
"""

import asyncio
import json
import logging
import math
import os
from typing import Any, Optional, Union
import urllib.request
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    httpx = None
    HTTPX_AVAILABLE = False

from app.services.shipment_service import shipment_service

logger = logging.getLogger(__name__)

try:
    import networkx as nx
    NETWORKX_AVAILABLE = True
except ImportError:
    NETWORKX_AVAILABLE = False


# Standard Global Supply Chain Nodes
DEFAULT_NODES: dict[str, dict[str, Any]] = {
    # East Asia
    "Shanghai": {"name": "Port of Shanghai", "city": "Shanghai", "country": "CN", "region": "East_Asia", "type": "Port", "lat": 31.2304, "lon": 121.4737, "congestion_level": 78.0},
    "Ningbo": {"name": "Port of Ningbo-Zhoushan", "city": "Ningbo", "country": "CN", "region": "East_Asia", "type": "Port", "lat": 29.8683, "lon": 121.5440, "congestion_level": 65.0},
    "Shenzhen": {"name": "Port of Shenzhen (Yantian)", "city": "Shenzhen", "country": "CN", "region": "East_Asia", "type": "Port", "lat": 22.5431, "lon": 114.0579, "congestion_level": 70.0},
    "Busan": {"name": "Port of Busan", "city": "Busan", "country": "KR", "region": "East_Asia", "type": "Port", "lat": 35.1796, "lon": 129.0756, "congestion_level": 55.0},
    "Tokyo": {"name": "Tokyo Logistics Hub", "city": "Tokyo", "country": "JP", "region": "East_Asia", "type": "Airport_Hub", "lat": 35.6762, "lon": 139.6503, "congestion_level": 40.0},
    "Hong_Kong": {"name": "Hong Kong Air Cargo Gateway", "city": "Hong Kong", "country": "HK", "region": "East_Asia", "type": "Airport_Hub", "lat": 22.3193, "lon": 114.1694, "congestion_level": 45.0},

    # Southeast Asia
    "Singapore": {"name": "Port of Singapore Hub", "city": "Singapore", "country": "SG", "region": "Southeast_Asia", "type": "Port", "lat": 1.3521, "lon": 103.8198, "congestion_level": 60.0},
    "Ho_Chi_Minh_City": {"name": "Cat Lai Port Hub", "city": "Ho Chi Minh City", "country": "VN", "region": "Southeast_Asia", "type": "Port", "lat": 10.8231, "lon": 106.6297, "congestion_level": 62.0},
    "Malacca_Strait": {"name": "Malacca Transit Waypoint", "city": "Malacca Strait", "country": "MY", "region": "Southeast_Asia", "type": "Transit_Waypoint", "lat": 2.5000, "lon": 101.5000, "congestion_level": 50.0},

    # South Asia & Middle East
    "Mumbai": {"name": "Nhava Sheva Port (JNPT)", "city": "Mumbai", "country": "IN", "region": "South_Asia", "type": "Port", "lat": 18.9647, "lon": 72.8258, "congestion_level": 58.0},
    "Vijayawada": {"name": "Vijayawada Logistics Hub", "city": "Vijayawada", "country": "IN", "region": "South_Asia", "type": "Inland_Hub", "lat": 16.5062, "lon": 80.6480, "congestion_level": 35.0},
    "Guntur": {"name": "Guntur Logistics Terminal", "city": "Guntur", "country": "IN", "region": "South_Asia", "type": "Inland_Hub", "lat": 16.3067, "lon": 80.4365, "congestion_level": 30.0},
    "H_Junction": {"name": "Hanuman Junction (H Junction)", "city": "Hanuman Junction", "country": "IN", "region": "South_Asia", "type": "Road_Hub", "lat": 16.5683, "lon": 80.9496, "congestion_level": 25.0},
    "Machilipatnam": {"name": "Machilipatnam Port & Logistics", "city": "Machilipatnam", "country": "IN", "region": "South_Asia", "type": "Port", "lat": 16.1808, "lon": 81.1303, "congestion_level": 20.0},
    "Nuzuvidu": {"name": "Nuzvid Freight Center", "city": "Nuzvid", "country": "IN", "region": "South_Asia", "type": "Inland_Hub", "lat": 16.7850, "lon": 80.8488, "congestion_level": 20.0},
    "Visakhapatnam": {"name": "Port of Visakhapatnam", "city": "Visakhapatnam", "country": "IN", "region": "South_Asia", "type": "Port", "lat": 17.6868, "lon": 83.2185, "congestion_level": 40.0},
    "Hyderabad": {"name": "Hyderabad Logistics Center", "city": "Hyderabad", "country": "IN", "region": "South_Asia", "type": "Inland_Hub", "lat": 17.3850, "lon": 78.4867, "congestion_level": 45.0},
    "Chennai": {"name": "Chennai Port & Hub", "city": "Chennai", "country": "IN", "region": "South_Asia", "type": "Port", "lat": 13.0827, "lon": 80.2707, "congestion_level": 50.0},
    "Delhi": {"name": "Delhi NCR Freight Terminal", "city": "Delhi", "country": "IN", "region": "South_Asia", "type": "Rail_Terminal", "lat": 28.6139, "lon": 77.2090, "congestion_level": 55.0},
    "Kolkata": {"name": "Kolkata Port Gateway", "city": "Kolkata", "country": "IN", "region": "South_Asia", "type": "Port", "lat": 22.5726, "lon": 88.3639, "congestion_level": 50.0},
    "Dubai": {"name": "Jebel Ali Port & Hub", "city": "Dubai", "country": "AE", "region": "Middle_East", "type": "Port", "lat": 25.2048, "lon": 55.2708, "congestion_level": 42.0},
    "Suez_Canal": {"name": "Suez Canal Maritime Gateway", "city": "Suez", "country": "EG", "region": "Middle_East", "type": "Transit_Waypoint", "lat": 30.5852, "lon": 32.5653, "congestion_level": 65.0},

    # Europe
    "Rotterdam": {"name": "Port of Rotterdam", "city": "Rotterdam", "country": "NL", "region": "Europe", "type": "Port", "lat": 51.9244, "lon": 4.4777, "congestion_level": 68.0},
    "Hamburg": {"name": "Port of Hamburg", "city": "Hamburg", "country": "DE", "region": "Europe", "type": "Port", "lat": 53.5511, "lon": 9.9937, "congestion_level": 64.0},
    "Antwerp": {"name": "Port of Antwerp", "city": "Antwerp", "country": "BE", "region": "Europe", "type": "Port", "lat": 51.2194, "lon": 4.4025, "congestion_level": 52.0},
    "Frankfurt": {"name": "Frankfurt CargoCity Intermodal Hub", "city": "Frankfurt", "country": "DE", "region": "Europe", "type": "Airport_Hub", "lat": 50.1109, "lon": 8.6821, "congestion_level": 48.0},

    # North America
    "Long_Beach": {"name": "Port of Long Beach", "city": "Long Beach", "country": "US", "region": "North_America", "type": "Port", "lat": 33.7701, "lon": -118.1937, "congestion_level": 82.0},
    "Los_Angeles": {"name": "Port of Los Angeles", "city": "Los Angeles", "country": "US", "region": "North_America", "type": "Port", "lat": 34.0522, "lon": -118.2437, "congestion_level": 75.0},
    "Oakland": {"name": "Port of Oakland", "city": "Oakland", "country": "US", "region": "North_America", "type": "Port", "lat": 37.8044, "lon": -122.2712, "congestion_level": 58.0},
    "Seattle": {"name": "Port of Seattle", "city": "Seattle", "country": "US", "region": "North_America", "type": "Port", "lat": 47.6062, "lon": -122.3321, "congestion_level": 45.0},
    "Chicago": {"name": "Chicago BNSF Logistics Hub", "city": "Chicago", "country": "US", "region": "North_America", "type": "Rail_Terminal", "lat": 41.8781, "lon": -87.6298, "congestion_level": 60.0},
    "Dallas": {"name": "Dallas-Fort Worth Distribution Hub", "city": "Dallas", "country": "US", "region": "North_America", "type": "Inland_Hub", "lat": 32.7767, "lon": -96.7970, "congestion_level": 40.0},
    "Atlanta": {"name": "Atlanta Freight Logistics Gateway", "city": "Atlanta", "country": "US", "region": "North_America", "type": "Inland_Hub", "lat": 33.7490, "lon": -84.3880, "congestion_level": 42.0},
    "Phoenix": {"name": "Phoenix Inland Freight Hub", "city": "Phoenix", "country": "US", "region": "North_America", "type": "Road_Hub", "lat": 33.4484, "lon": -112.0740, "congestion_level": 25.0},
    "Oklahoma_City": {"name": "Oklahoma City Corridor Hub", "city": "Oklahoma City", "country": "US", "region": "North_America", "type": "Road_Hub", "lat": 35.4676, "lon": -97.5164, "congestion_level": 30.0},
    "Toronto": {"name": "Toronto Intermodal Logistics Hub", "city": "Toronto", "country": "CA", "region": "North_America", "type": "Inland_Hub", "lat": 43.6532, "lon": -79.3832, "congestion_level": 38.0},

    # Latin America
    "Monterrey": {"name": "Monterrey Industrial Gateway", "city": "Monterrey", "country": "MX", "region": "Latin_America", "type": "Inland_Hub", "lat": 25.6866, "lon": -100.3161, "congestion_level": 35.0},
    "Mexico_City": {"name": "Mexico City Logistics Hub", "city": "Mexico City", "country": "MX", "region": "Latin_America", "type": "Inland_Hub", "lat": 19.4326, "lon": -99.1332, "congestion_level": 50.0},
    "Panama_Canal": {"name": "Panama Canal Transit Waypoint", "city": "Panama City", "country": "PA", "region": "Latin_America", "type": "Transit_Waypoint", "lat": 9.0800, "lon": -79.6800, "congestion_level": 70.0},

    # Oceania
    "Sydney": {"name": "Port Botany Logistics Hub", "city": "Sydney", "country": "AU", "region": "Oceania", "type": "Port", "lat": -33.8688, "lon": 151.2093, "congestion_level": 35.0},
}


# Multimodal Interconnected Route Segments (Bidirectional edges)
DEFAULT_EDGES: list[tuple[str, str, dict[str, Any]]] = [
    # Trans-Pacific Ocean Corridors
    ("Shanghai", "Long_Beach", {"distance_km": 10400.0, "base_time_hours": 336.0, "mode": "Ocean", "corridor_name": "Trans-Pacific North Central", "status": "Active", "risk_weight": 1.25}),
    ("Shanghai", "Oakland", {"distance_km": 10100.0, "base_time_hours": 320.0, "mode": "Ocean", "corridor_name": "Trans-Pacific Northern", "status": "Active", "risk_weight": 1.05}),
    ("Shanghai", "Seattle", {"distance_km": 9400.0, "base_time_hours": 290.0, "mode": "Ocean", "corridor_name": "Great Circle Pacific Direct", "status": "Active", "risk_weight": 1.00}),
    ("Ningbo", "Long_Beach", {"distance_km": 10500.0, "base_time_hours": 340.0, "mode": "Ocean", "corridor_name": "Ningbo-LA Pacific Trunk", "status": "Active", "risk_weight": 1.20}),
    ("Shenzhen", "Long_Beach", {"distance_km": 11600.0, "base_time_hours": 360.0, "mode": "Ocean", "corridor_name": "South China Pacific Express", "status": "Active", "risk_weight": 1.15}),
    ("Busan", "Oakland", {"distance_km": 9200.0, "base_time_hours": 280.0, "mode": "Ocean", "corridor_name": "Korea-West Coast Direct", "status": "Active", "risk_weight": 1.00}),
    ("Busan", "Seattle", {"distance_km": 8400.0, "base_time_hours": 260.0, "mode": "Ocean", "corridor_name": "North Pacific Direct", "status": "Active", "risk_weight": 0.95}),
    ("Tokyo", "Seattle", {"distance_km": 7700.0, "base_time_hours": 240.0, "mode": "Ocean", "corridor_name": "Tokyo Bay Express", "status": "Active", "risk_weight": 0.90}),

    # East Asia Regional Feeder Network
    ("Shanghai", "Ningbo", {"distance_km": 180.0, "base_time_hours": 6.0, "mode": "Road", "corridor_name": "Hangzhou Bay Bridge Corridor", "status": "Active", "risk_weight": 1.00}),
    ("Shanghai", "Shenzhen", {"distance_km": 1250.0, "base_time_hours": 36.0, "mode": "Rail", "corridor_name": "China Coastal Rail Trunk", "status": "Active", "risk_weight": 1.00}),
    ("Shanghai", "Busan", {"distance_km": 850.0, "base_time_hours": 24.0, "mode": "Ocean", "corridor_name": "Yellow Sea Feeder", "status": "Active", "risk_weight": 1.00}),
    ("Shenzhen", "Hong_Kong", {"distance_km": 40.0, "base_time_hours": 2.0, "mode": "Road", "corridor_name": "Greater Bay Cross-Border Expressway", "status": "Active", "risk_weight": 1.00}),
    ("Hong_Kong", "Tokyo", {"distance_km": 2900.0, "base_time_hours": 5.0, "mode": "Air", "corridor_name": "East Asia Air Freight Corridor", "status": "Active", "risk_weight": 0.85}),

    # Southeast Asia & Oceania
    ("Singapore", "Ho_Chi_Minh_City", {"distance_km": 1100.0, "base_time_hours": 36.0, "mode": "Ocean", "corridor_name": "South China Sea Southern Feeder", "status": "Active", "risk_weight": 1.00}),
    ("Ho_Chi_Minh_City", "Seattle", {"distance_km": 11800.0, "base_time_hours": 380.0, "mode": "Ocean", "corridor_name": "Trans-Pacific Southeast Link", "status": "Active", "risk_weight": 1.10}),
    ("Singapore", "Sydney", {"distance_km": 6300.0, "base_time_hours": 190.0, "mode": "Ocean", "corridor_name": "Indo-Pacific Gateway", "status": "Active", "risk_weight": 1.00}),
    ("Singapore", "Malacca_Strait", {"distance_km": 250.0, "base_time_hours": 8.0, "mode": "Ocean", "corridor_name": "Malacca Strait Inbound", "status": "Active", "risk_weight": 1.10}),

    # South Asia Regional & Multimodal Network
    ("Vijayawada", "Guntur", {"distance_km": 35.0, "base_time_hours": 1.0, "mode": "Road", "corridor_name": "NH 16 Vijayawada-Guntur Expressway", "status": "Active", "risk_weight": 0.90}),
    ("Vijayawada", "H_Junction", {"distance_km": 42.0, "base_time_hours": 1.2, "mode": "Road", "corridor_name": "NH 16 Eluru Road Trunk", "status": "Active", "risk_weight": 0.95}),
    ("H_Junction", "Machilipatnam", {"distance_km": 45.0, "base_time_hours": 1.5, "mode": "Road", "corridor_name": "Gudivada-Machilipatnam Road", "status": "Active", "risk_weight": 0.95}),
    ("Vijayawada", "Machilipatnam", {"distance_km": 70.0, "base_time_hours": 2.0, "mode": "Road", "corridor_name": "NH 65 Bandar Road Corridor", "status": "Active", "risk_weight": 1.00}),
    ("Vijayawada", "Nuzuvidu", {"distance_km": 45.0, "base_time_hours": 1.3, "mode": "Road", "corridor_name": "Vijayawada-Nuzvid Highway", "status": "Active", "risk_weight": 0.95}),
    ("H_Junction", "Nuzuvidu", {"distance_km": 28.0, "base_time_hours": 0.8, "mode": "Road", "corridor_name": "Hanuman Junction-Nuzvid Road", "status": "Active", "risk_weight": 0.90}),
    ("Vijayawada", "Visakhapatnam", {"distance_km": 350.0, "base_time_hours": 6.5, "mode": "Road", "corridor_name": "NH 16 Coastal Trunk", "status": "Active", "risk_weight": 1.05}),
    ("H_Junction", "Visakhapatnam", {"distance_km": 310.0, "base_time_hours": 5.8, "mode": "Road", "corridor_name": "NH 16 North Coastal Corridor", "status": "Active", "risk_weight": 1.00}),
    ("Vijayawada", "Hyderabad", {"distance_km": 275.0, "base_time_hours": 5.0, "mode": "Road", "corridor_name": "NH 65 Hyderabad-Vijayawada Highway", "status": "Active", "risk_weight": 0.95}),
    ("Vijayawada", "Chennai", {"distance_km": 430.0, "base_time_hours": 7.5, "mode": "Road", "corridor_name": "NH 16 Southern Corridor", "status": "Active", "risk_weight": 1.00}),
    ("Mumbai", "Vijayawada", {"distance_km": 950.0, "base_time_hours": 18.0, "mode": "Rail", "corridor_name": "Central-Eastern Intermodal Rail", "status": "Active", "risk_weight": 1.00}),
    ("Visakhapatnam", "Kolkata", {"distance_km": 880.0, "base_time_hours": 16.0, "mode": "Rail", "corridor_name": "East Coast Rail Corridor", "status": "Active", "risk_weight": 1.00}),
    ("Chennai", "Singapore", {"distance_km": 2900.0, "base_time_hours": 90.0, "mode": "Ocean", "corridor_name": "Bay of Bengal - Malacca Sea Lane", "status": "Active", "risk_weight": 1.00}),

    # Asia -> Middle East -> Europe Maritime Corridors
    ("Malacca_Strait", "Mumbai", {"distance_km": 3900.0, "base_time_hours": 120.0, "mode": "Ocean", "corridor_name": "Bay of Bengal Maritime Route", "status": "Active", "risk_weight": 1.00}),
    ("Mumbai", "Dubai", {"distance_km": 1950.0, "base_time_hours": 60.0, "mode": "Ocean", "corridor_name": "Arabian Sea Route", "status": "Active", "risk_weight": 0.95}),
    ("Dubai", "Suez_Canal", {"distance_km": 2800.0, "base_time_hours": 85.0, "mode": "Ocean", "corridor_name": "Red Sea / Gulf of Aden Lane", "status": "Active", "risk_weight": 1.30}),
    ("Suez_Canal", "Rotterdam", {"distance_km": 6100.0, "base_time_hours": 180.0, "mode": "Ocean", "corridor_name": "Mediterranean-Gibraltar-North Sea", "status": "Active", "risk_weight": 1.15}),
    ("Suez_Canal", "Antwerp", {"distance_km": 6000.0, "base_time_hours": 175.0, "mode": "Ocean", "corridor_name": "Scheldt Maritime Inbound", "status": "Active", "risk_weight": 1.10}),

    # Europe Inland Intermodal Network
    ("Rotterdam", "Hamburg", {"distance_km": 480.0, "base_time_hours": 16.0, "mode": "Ocean", "corridor_name": "North Sea Feeder", "status": "Active", "risk_weight": 1.20}),
    ("Rotterdam", "Antwerp", {"distance_km": 100.0, "base_time_hours": 3.0, "mode": "Road", "corridor_name": "Benelux Freight Expressway", "status": "Active", "risk_weight": 0.90}),
    ("Rotterdam", "Frankfurt", {"distance_km": 440.0, "base_time_hours": 8.0, "mode": "Rail", "corridor_name": "Rhine-Alpine Rail Freight Corridor", "status": "Active", "risk_weight": 0.95}),
    ("Antwerp", "Frankfurt", {"distance_km": 390.0, "base_time_hours": 7.5, "mode": "Rail", "corridor_name": "Rhine Intermodal Rail", "status": "Active", "risk_weight": 0.95}),
    ("Frankfurt", "Hamburg", {"distance_km": 500.0, "base_time_hours": 9.0, "mode": "Rail", "corridor_name": "German Federal Rail Network", "status": "Active", "risk_weight": 0.95}),

    # Trans-Atlantic Air & Ocean Link
    ("Frankfurt", "Toronto", {"distance_km": 6350.0, "base_time_hours": 9.5, "mode": "Air", "corridor_name": "North Atlantic Air Cargo Corridor", "status": "Active", "risk_weight": 0.90}),
    ("Rotterdam", "Toronto", {"distance_km": 6100.0, "base_time_hours": 210.0, "mode": "Ocean", "corridor_name": "St. Lawrence Maritime Route", "status": "Active", "risk_weight": 1.05}),

    # North American Intermodal & Rail/Road Network
    ("Long_Beach", "Los_Angeles", {"distance_km": 35.0, "base_time_hours": 1.5, "mode": "Road", "corridor_name": "Alameda Freight Corridor", "status": "Active", "risk_weight": 1.10}),
    ("Los_Angeles", "Phoenix", {"distance_km": 600.0, "base_time_hours": 8.5, "mode": "Road", "corridor_name": "Interstate 10 Southwestern Corridor", "status": "Active", "risk_weight": 0.90}),
    ("Los_Angeles", "Oakland", {"distance_km": 610.0, "base_time_hours": 9.0, "mode": "Road", "corridor_name": "Interstate 5 California Spine", "status": "Active", "risk_weight": 1.00}),
    ("Oakland", "Seattle", {"distance_km": 1300.0, "base_time_hours": 18.0, "mode": "Rail", "corridor_name": "Pacific Northwest Rail Trunk", "status": "Active", "risk_weight": 1.00}),
    ("Los_Angeles", "Chicago", {"distance_km": 3250.0, "base_time_hours": 52.0, "mode": "Rail", "corridor_name": "BNSF Southern Transcon Rail", "status": "Active", "risk_weight": 0.95}),
    ("Phoenix", "Dallas", {"distance_km": 1700.0, "base_time_hours": 24.0, "mode": "Road", "corridor_name": "I-20 Southern Highway Corridor", "status": "Active", "risk_weight": 0.90}),
    ("Chicago", "Dallas", {"distance_km": 1500.0, "base_time_hours": 22.0, "mode": "Rail", "corridor_name": "Midwest-Texas Central Rail Link", "status": "Active", "risk_weight": 1.05}),
    ("Chicago", "Oklahoma_City", {"distance_km": 1280.0, "base_time_hours": 18.0, "mode": "Road", "corridor_name": "I-55 / I-44 Central Route", "status": "Active", "risk_weight": 1.00}),
    ("Oklahoma_City", "Dallas", {"distance_km": 330.0, "base_time_hours": 4.5, "mode": "Road", "corridor_name": "I-35 Texas Corridor", "status": "Active", "risk_weight": 1.15}),
    ("Dallas", "Atlanta", {"distance_km": 1260.0, "base_time_hours": 17.5, "mode": "Road", "corridor_name": "I-20 Southeast Freight Link", "status": "Active", "risk_weight": 0.95}),
    ("Chicago", "Toronto", {"distance_km": 830.0, "base_time_hours": 12.0, "mode": "Rail", "corridor_name": "Great Lakes Intermodal Cross-Border", "status": "Active", "risk_weight": 0.95}),

    # Latin America Cross-Border Corridors
    ("Mexico_City", "Monterrey", {"distance_km": 920.0, "base_time_hours": 13.0, "mode": "Road", "corridor_name": "Mexican Federal Highway 57D", "status": "Active", "risk_weight": 1.05}),
    ("Monterrey", "Dallas", {"distance_km": 870.0, "base_time_hours": 12.5, "mode": "Road", "corridor_name": "Laredo Cross-Border Gateway", "status": "Active", "risk_weight": 1.10}),
    ("Monterrey", "Atlanta", {"distance_km": 1900.0, "base_time_hours": 26.0, "mode": "Road", "corridor_name": "Gulf Coast Cross-Border Corridor", "status": "Active", "risk_weight": 1.05}),
    ("Long_Beach", "Panama_Canal", {"distance_km": 5400.0, "base_time_hours": 165.0, "mode": "Ocean", "corridor_name": "Pacific-Panama Canal Maritime Route", "status": "Active", "risk_weight": 1.15}),
]


class FallbackDiGraph:
    """Lightweight NetworkX-compatible DiGraph implementation when NetworkX is loading dynamically."""

    def __init__(self):
        self._nodes: dict[str, dict[str, Any]] = {}
        self._succ: dict[str, dict[str, dict[str, Any]]] = {}
        self._pred: dict[str, dict[str, dict[str, Any]]] = {}

    def add_node(self, node_id: str, **attrs):
        self._nodes[node_id] = attrs
        if node_id not in self._succ:
            self._succ[node_id] = {}
        if node_id not in self._pred:
            self._pred[node_id] = {}

    def add_edge(self, u: str, v: str, **attrs):
        if u not in self._nodes:
            self.add_node(u)
        if v not in self._nodes:
            self.add_node(v)
        self._succ[u][v] = attrs
        self._pred[v][u] = attrs

    @property
    def nodes(self):
        return self._nodes

    def neighbors(self, node_id: str):
        return iter(self._succ.get(node_id, {}).keys())

    def successors(self, node_id: str):
        return iter(self._succ.get(node_id, {}).keys())

    def predecessors(self, node_id: str):
        return iter(self._pred.get(node_id, {}).keys())

    def get_edge_data(self, u: str, v: str, default=None):
        return self._succ.get(u, {}).get(v, default)

    def number_of_nodes(self) -> int:
        return len(self._nodes)

    def number_of_edges(self) -> int:
        return sum(len(d) for d in self._succ.values())

    def has_node(self, node_id: str) -> bool:
        return node_id in self._nodes

    def has_edge(self, u: str, v: str) -> bool:
        return u in self._succ and v in self._succ[u]


def build_supply_chain_graph() -> Union["nx.DiGraph", FallbackDiGraph]:
    """Construct and populate the supply chain logistics graph using NetworkX."""
    if NETWORKX_AVAILABLE:
        G = nx.DiGraph(name="Global Supply Chain Multimodal Logistics Network")
    else:
        G = FallbackDiGraph()

    # 1. Add all nodes
    for node_id, attrs in DEFAULT_NODES.items():
        G.add_node(node_id, **attrs)

    # 2. Add bidirectional edges
    for u, v, attrs in DEFAULT_EDGES:
        G.add_edge(u, v, **attrs)
        # Symmetrical reverse edge
        rev_attrs = dict(attrs)
        G.add_edge(v, u, **rev_attrs)

    return G


class SupplyChainRouteNetwork:
    """Network service managing the global logistics topology and connectivity."""

    def __init__(self):
        self.graph = build_supply_chain_graph()

    def get_nodes(self) -> list[dict[str, Any]]:
        """Return all nodes in the logistics graph with their metadata."""
        result = []
        if NETWORKX_AVAILABLE:
            for node_id, data in self.graph.nodes(data=True):
                result.append({"node_id": node_id, **data})
        else:
            for node_id, data in self.graph.nodes.items():
                result.append({"node_id": node_id, **data})
        return result

    def get_node(self, node_id: str) -> Optional[dict[str, Any]]:
        """Retrieve node attributes by ID (supports case-insensitive matching)."""
        clean_id = self._normalize_node_name(node_id)
        if self.graph.has_node(clean_id):
            attrs = self.graph.nodes[clean_id]
            return {"node_id": clean_id, **attrs}
        return None

    def get_node_coordinates(self, node_name: str) -> Optional[dict[str, float]]:
        """Retrieve latitude and longitude geographic coordinates for any network node or alias."""
        clean = self._normalize_node_name(node_name)
        node_data = self.get_node(clean)
        if node_data and "lat" in node_data and "lon" in node_data:
            return {"lat": float(node_data["lat"]), "lon": float(node_data["lon"])}
        if clean in DEFAULT_NODES:
            return {"lat": float(DEFAULT_NODES[clean]["lat"]), "lon": float(DEFAULT_NODES[clean]["lon"])}
        return None

    def get_edges(self) -> list[dict[str, Any]]:
        """Return all directional edge corridors in the network."""
        edges = []
        for node in self.graph.nodes:
            for neighbor in self.graph.neighbors(node):
                edge_data = self.graph.get_edge_data(node, neighbor)
                edges.append({
                    "origin": node,
                    "destination": neighbor,
                    **edge_data
                })
        return edges

    def get_edge(self, u: str, v: str) -> Optional[dict[str, Any]]:
        """Retrieve direct corridor connection attributes between two nodes."""
        u_clean = self._normalize_node_name(u)
        v_clean = self._normalize_node_name(v)
        data = self.graph.get_edge_data(u_clean, v_clean)
        if data:
            return {"origin": u_clean, "destination": v_clean, **data}
        return None

    def get_neighbors(self, node_id: str) -> list[str]:
        """Return list of directly reachable adjacent hubs from a given node."""
        clean_id = self._normalize_node_name(node_id)
        if not self.graph.has_node(clean_id):
            return []
        return list(self.graph.neighbors(clean_id))

    def find_available_routes(self, origin: str, destination: str, max_depth: int = 5) -> list[list[str]]:
        """Find all acyclic paths between origin and destination within max_depth hops."""
        orig_clean = self._normalize_node_name(origin)
        dest_clean = self._normalize_node_name(destination)

        if not self.graph.has_node(orig_clean) or not self.graph.has_node(dest_clean):
            return []

        if NETWORKX_AVAILABLE:
            try:
                paths = list(nx.all_simple_paths(self.graph, source=orig_clean, target=dest_clean, cutoff=max_depth))
                return paths
            except Exception:
                pass

        # Fallback DFS path search
        paths = []
        def dfs(curr, target, visited, depth):
            if depth > max_depth:
                return
            if curr == target:
                paths.append(list(visited))
                return
            for nxt in self.graph.neighbors(curr):
                if nxt not in visited:
                    visited.append(nxt)
                    dfs(nxt, target, visited, depth + 1)
                    visited.pop()

        dfs(orig_clean, dest_clean, [orig_clean], 0)
        return paths

    def _compute_dynamic_edge_penalties(self) -> tuple[dict[tuple[str, str], float], dict[str, Any]]:
        """
        Query real-time disruption telemetry across weather, port congestion,
        and road/rail traffic, calculating dynamic additive risk weight penalties per corridor.
        """
        penalties: dict[tuple[str, str], float] = {}
        meta = {
            "external_disruptions_considered": True,
            "weather_disruption_count": 0,
            "port_disruption_count": 0,
            "traffic_disruption_count": 0,
            "data_sources": set(),
            "is_mock_fallback_used": False,
            "hotspot_nodes": {},
        }

        try:
            from app.services.alert_service import external_disruption_service
            from app.schemas.predictions import DisruptionType

            active_events = external_disruption_service.get_active_disruptions()
            for ev in active_events:
                if ev.source_provider:
                    meta["data_sources"].add(ev.source_provider)
                if ev.is_mock:
                    meta["is_mock_fallback_used"] = True

                loc_name = self._normalize_node_name(ev.location.name)
                sev_score = float(ev.severity_score)
                meta["hotspot_nodes"][loc_name] = max(meta["hotspot_nodes"].get(loc_name, 0.0), sev_score)

                if ev.disruption_type == DisruptionType.WEATHER:
                    meta["weather_disruption_count"] += 1
                    delta_r = (sev_score / 100.0) * 1.5
                elif ev.disruption_type == DisruptionType.PORT_CONGESTION:
                    meta["port_disruption_count"] += 1
                    delta_r = (sev_score / 100.0) * 2.2
                elif ev.disruption_type == DisruptionType.TRAFFIC:
                    meta["traffic_disruption_count"] += 1
                    delay_m = float(ev.metrics.get("delay_minutes", 45.0))
                    delta_r = min(2.5, (delay_m / 60.0) * 1.4)
                else:
                    delta_r = (sev_score / 100.0) * 1.0

                if self.graph.has_node(loc_name):
                    for neighbor in self.graph.neighbors(loc_name):
                        penalties[(loc_name, neighbor)] = penalties.get((loc_name, neighbor), 0.0) + delta_r
                        penalties[(neighbor, loc_name)] = penalties.get((neighbor, loc_name), 0.0) + delta_r
        except Exception:
            pass

        meta["data_sources"] = sorted(list(meta["data_sources"]))
        return penalties, meta

    def dijkstra_shortest_path(
        self,
        origin: str,
        destination: str,
        criterion: str = "time",
        avoid_nodes: Optional[list[str]] = None,
        ml_risk_score: Optional[int] = None,
        use_realtime_disruptions: bool = True,
    ) -> dict[str, Any]:
        """Compute the optimal route between origin and destination using NetworkX Dijkstra with real-time disruption weighting."""
        orig_clean = self._normalize_node_name(origin)
        dest_clean = self._normalize_node_name(destination)

        if not self.graph.has_node(orig_clean):
            raise ValueError(f"Origin location '{origin}' (resolved to '{orig_clean}') is not present in the logistics graph.")
        if not self.graph.has_node(dest_clean):
            raise ValueError(f"Destination location '{destination}' (resolved to '{dest_clean}') is not present in the logistics graph.")

        if orig_clean == dest_clean:
            return {
                "origin": orig_clean,
                "destination": dest_clean,
                "path": [orig_clean],
                "criterion": criterion,
                "total_distance_km": 0.0,
                "estimated_time_hours": 0.0,
                "total_cost": 0.0,
                "transport_modes": [],
                "segments": [],
                "algorithm": "NETWORKX_DIJKSTRA",
                "route_geometry": compute_path_geometry_sync([orig_clean]),
                "ml_risk_score": ml_risk_score,
                "ml_risk_level": "LOW",
                "external_disruptions_considered": False,
                "weather_disruption_count": 0,
                "port_disruption_count": 0,
                "traffic_disruption_count": 0,
                "route_risk_before": 1.0,
                "route_risk_after": 1.0,
                "dynamic_risk_penalty": 0.0,
                "decision_reason": "Origin and destination are identical.",
                "data_sources": [],
                "is_mock_fallback_used": False,
            }

        avoid_set = {self._normalize_node_name(n) for n in (avoid_nodes or [])}
        avoid_set.discard(orig_clean)
        avoid_set.discard(dest_clean)

        edge_penalties, meta = (
            self._compute_dynamic_edge_penalties()
            if (criterion == "risk_adjusted" and use_realtime_disruptions)
            else ({}, {
                "external_disruptions_considered": False,
                "weather_disruption_count": 0,
                "port_disruption_count": 0,
                "traffic_disruption_count": 0,
                "data_sources": [],
                "is_mock_fallback_used": False,
                "hotspot_nodes": {},
            })
        )

        ml_multiplier = 1.0 + (float(ml_risk_score) / 100.0) * 0.5 if ml_risk_score is not None else 1.0

        def weight_func(u, v, d):
            if v in avoid_set and v != dest_clean:
                return float("inf")
            if criterion == "distance":
                return float(d.get("distance_km", 1.0))
            elif criterion == "risk_adjusted":
                base_time = float(d.get("base_time_hours", 1.0))
                base_risk_wt = float(d.get("risk_weight", 1.0))
                dynamic_penalty = edge_penalties.get((u, v), 0.0)
                eff_risk_wt = (base_risk_wt + dynamic_penalty) * ml_multiplier
                return base_time * eff_risk_wt
            else:  # default "time"
                return float(d.get("base_time_hours", 1.0))

        path = None
        total_cost = 0.0

        if NETWORKX_AVAILABLE:
            try:
                path = nx.dijkstra_path(self.graph, source=orig_clean, target=dest_clean, weight=weight_func)
                total_cost = nx.dijkstra_path_length(self.graph, source=orig_clean, target=dest_clean, weight=weight_func)
            except nx.NetworkXNoPath:
                raise ValueError(f"No viable route path found between '{orig_clean}' and '{dest_clean}'.")
            except Exception:
                pass

        if path is None:
            # Standalone Priority-Queue Dijkstra Fallback
            import heapq
            distances = {node: float("inf") for node in self.graph.nodes}
            previous = {node: None for node in self.graph.nodes}
            distances[orig_clean] = 0.0
            pq = [(0.0, orig_clean)]

            while pq:
                curr_dist, curr_node = heapq.heappop(pq)
                if curr_dist > distances[curr_node]:
                    continue
                if curr_node == dest_clean:
                    break
                for neighbor in self.graph.neighbors(curr_node):
                    if neighbor in avoid_set and neighbor != dest_clean:
                        continue
                    edge_attrs = self.graph.get_edge_data(curr_node, neighbor) or {}
                    w = weight_func(curr_node, neighbor, edge_attrs)
                    new_dist = curr_dist + w
                    if new_dist < distances[neighbor]:
                        distances[neighbor] = new_dist
                        previous[neighbor] = curr_node
                        heapq.heappush(pq, (new_dist, neighbor))

            if distances[dest_clean] == float("inf"):
                raise ValueError(f"No viable route path found between '{orig_clean}' and '{dest_clean}'.")

            path = []
            curr = dest_clean
            while curr is not None:
                path.append(curr)
                curr = previous[curr]
            path.reverse()
            total_cost = distances[dest_clean]

        # Calculate exact route segment metrics
        total_distance = 0.0
        total_time = 0.0
        transport_modes = []
        segments = []
        base_risk_weights = []
        effective_risk_weights = []

        for i in range(len(path) - 1):
            u_node = path[i]
            v_node = path[i + 1]
            e_data = self.graph.get_edge_data(u_node, v_node) or {}
            
            dist = float(e_data.get("distance_km", 0.0))
            time_h = float(e_data.get("base_time_hours", 0.0))
            mode = str(e_data.get("mode", "Multimodal"))
            corridor = str(e_data.get("corridor_name", f"{u_node} -> {v_node} Segment"))
            status = str(e_data.get("status", "Active"))
            base_risk_wt = float(e_data.get("risk_weight", 1.0))
            dynamic_penalty = edge_penalties.get((u_node, v_node), 0.0)
            eff_risk_wt = (base_risk_wt + dynamic_penalty) * ml_multiplier

            if criterion == "distance":
                seg_cost = dist
            elif criterion == "risk_adjusted":
                seg_cost = time_h * eff_risk_wt
            else:
                seg_cost = time_h

            total_distance += dist
            total_time += time_h
            base_risk_weights.append(base_risk_wt)
            effective_risk_weights.append(eff_risk_wt)

            if mode not in transport_modes:
                transport_modes.append(mode)

            segments.append({
                "origin": u_node,
                "destination": v_node,
                "distance_km": round(dist, 1),
                "base_time_hours": round(time_h, 1),
                "mode": mode,
                "corridor_name": corridor,
                "status": status,
                "risk_weight": round(eff_risk_wt, 2),
                "effective_cost": round(seg_cost, 2),
            })

        avg_base_risk = sum(base_risk_weights) / len(base_risk_weights) if base_risk_weights else 1.0
        avg_eff_risk = sum(effective_risk_weights) / len(effective_risk_weights) if effective_risk_weights else 1.0
        max_risk = max(effective_risk_weights) if effective_risk_weights else 1.0
        delta_penalty = round(avg_eff_risk - avg_base_risk, 2)

        if max_risk >= 1.50 or avg_eff_risk >= 1.35:
            route_risk_level = "CRITICAL"
        elif max_risk >= 1.25 or avg_eff_risk >= 1.20:
            route_risk_level = "HIGH"
        elif max_risk >= 1.10 or avg_eff_risk >= 1.05:
            route_risk_level = "MEDIUM"
        else:
            route_risk_level = "LOW"

        if criterion == "risk_adjusted":
            if delta_penalty > 0.05:
                reason = f"Dijkstra dynamically evaluated live disruptions across corridor. Recommended path maximizes operational resiliency (Average risk factor: {avg_eff_risk:.2f}, Dynamic penalty: +{delta_penalty:.2f})."
            else:
                reason = f"Dijkstra risk-optimized route selected to minimize operational disruption exposure (Average risk factor: {avg_eff_risk:.2f}, Effective cost: {total_cost:.2f})."
        elif criterion == "distance":
            reason = f"Dijkstra shortest geographical route selected (Total distance: {total_distance:.1f} km)."
        else:
            reason = f"Dijkstra fastest scheduled transit route selected (Total estimated time: {total_time:.1f} hrs)."

        return {
            "origin": orig_clean,
            "destination": dest_clean,
            "path": path,
            "criterion": criterion,
            "total_distance_km": round(total_distance, 1),
            "estimated_time_hours": round(total_time, 1),
            "total_cost": round(total_cost, 2),
            "transport_modes": transport_modes,
            "average_risk_weight": round(avg_eff_risk, 2),
            "max_segment_risk_weight": round(max_risk, 2),
            "route_risk_level": route_risk_level,
            "reason": reason,
            "segments": segments,
            "algorithm": "NETWORKX_DIJKSTRA",
            "route_geometry": compute_path_geometry_sync(path),
            "ml_risk_score": ml_risk_score,
            "ml_risk_level": route_risk_level,
            "external_disruptions_considered": meta["external_disruptions_considered"],
            "weather_disruption_count": meta["weather_disruption_count"],
            "port_disruption_count": meta["port_disruption_count"],
            "traffic_disruption_count": meta["traffic_disruption_count"],
            "route_risk_before": round(avg_base_risk, 2),
            "route_risk_after": round(avg_eff_risk, 2),
            "dynamic_risk_penalty": delta_penalty,
            "decision_reason": reason,
            "data_sources": meta.get("data_sources", []),
            "is_mock_fallback_used": meta.get("is_mock_fallback_used", False),
        }

    def _normalize_node_name(self, name: str) -> str:
        """Map common city names or raw shipment strings to standard graph node keys."""
        if not name:
            return ""
        raw_clean = name.strip()
        lower_raw = raw_clean.lower()
        first_token = raw_clean.split(",")[0].strip().replace(" ", "_")
        lower_first = first_token.lower()
        
        # Exact alias mappings
        aliases = {
            "la": "Los_Angeles",
            "l.a.": "Los_Angeles",
            "lax": "Los_Angeles",
            "los_angeles": "Los_Angeles",
            "hk": "Hong_Kong",
            "hkg": "Hong_Kong",
            "hong_kong": "Hong_Kong",
            "szx": "Shenzhen",
            "shenzhen": "Shenzhen",
            "yantian": "Shenzhen",
            "pvg": "Shanghai",
            "sha": "Shanghai",
            "shanghai": "Shanghai",
            "ningbo": "Ningbo",
            "nbo": "Ningbo",
            "busan": "Busan",
            "pus": "Busan",
            "tokyo": "Tokyo",
            "tyo": "Tokyo",
            "dfw": "Dallas",
            "dallas": "Dallas",
            "ord": "Chicago",
            "chicago": "Chicago",
            "fra": "Frankfurt",
            "frankfurt": "Frankfurt",
            "atl": "Atlanta",
            "atlanta": "Atlanta",
            "sea": "Seattle",
            "seattle": "Seattle",
            "oak": "Oakland",
            "oakland": "Oakland",
            "lgb": "Long_Beach",
            "long_beach": "Long_Beach",
            "rtm": "Rotterdam",
            "rotterdam": "Rotterdam",
            "ham": "Hamburg",
            "hamburg": "Hamburg",
            "anr": "Antwerp",
            "antwerp": "Antwerp",
            "sin": "Singapore",
            "singapore": "Singapore",
            "bom": "Mumbai",
            "mumbai": "Mumbai",
            "jnpt": "Mumbai",
            "nhava_sheva": "Mumbai",
            "dxb": "Dubai",
            "dubai": "Dubai",
            "jebel_ali": "Dubai",
            "syd": "Sydney",
            "sydney": "Sydney",
            "yyz": "Toronto",
            "toronto": "Toronto",
            "mex": "Mexico_City",
            "mexico_city": "Mexico_City",
            "mty": "Monterrey",
            "monterrey": "Monterrey",
            "okc": "Oklahoma_City",
            "oklahoma_city": "Oklahoma_City",
            "phx": "Phoenix",
            "phoenix": "Phoenix",
            "ho_chi_minh": "Ho_Chi_Minh_City",
            "hcm": "Ho_Chi_Minh_City",
            "sgn": "Ho_Chi_Minh_City",
            "ho_chi_minh_city": "Ho_Chi_Minh_City",
            "saigon": "Ho_Chi_Minh_City",
            "cat_lai": "Ho_Chi_Minh_City",
            # South Asia Regional Aliases
            "hjunction": "H_Junction",
            "h_junction": "H_Junction",
            "hanuman_junction": "H_Junction",
            "guntur": "Guntur",
            "vijayawada": "Vijayawada",
            "vja": "Vijayawada",
            "bezawada": "Vijayawada",
            "machilipatnam": "Machilipatnam",
            "nuzuvidu": "Nuzuvidu",
            "nuzvid": "Nuzuvidu",
            "vizag": "Visakhapatnam",
            "vtz": "Visakhapatnam",
            "visakhapatnam": "Visakhapatnam",
            "hyd": "Hyderabad",
            "hyderabad": "Hyderabad",
            "chennai": "Chennai",
            "maa": "Chennai",
            "madras": "Chennai",
            "delhi": "Delhi",
            "new_delhi": "Delhi",
            "del": "Delhi",
            "kolkata": "Kolkata",
            "ccu": "Kolkata",
            "calcutta": "Kolkata",
        }
        
        # 1. Alias match on full string or first token
        if lower_raw in aliases:
            return aliases[lower_raw]
        if lower_first in aliases:
            return aliases[lower_first]
        if first_token in aliases:
            return aliases[first_token]
        
        # 2. Check DEFAULT_NODES match
        for k in DEFAULT_NODES:
            k_lower = k.lower()
            k_stripped = k_lower.replace("_", "")
            if lower_first == k_lower or lower_first.replace("_", "") == k_stripped:
                return k
            if lower_raw == k_lower or lower_raw.replace("_", "") == k_stripped:
                return k
        
        return first_token

    def compute_path_metrics(
        self,
        path: list[str],
        criterion: str = "risk_adjusted",
        ml_risk_score: Optional[int] = None,
        use_realtime_disruptions: bool = True,
    ) -> dict[str, Any]:
        """Calculate exact segment breakdown, total cost, distance, time, and average effective risk for a given sequence of nodes."""
        if not path or len(path) == 0:
            return {
                "path": [],
                "total_distance_km": 0.0,
                "estimated_time_hours": 0.0,
                "total_cost": 0.0,
                "average_risk_weight": 1.0,
                "transport_modes": ["Multimodal"],
                "segments": [],
                "route_geometry": [],
            }

        edge_penalties, meta = (
            self._compute_dynamic_edge_penalties()
            if use_realtime_disruptions
            else ({}, {"external_disruptions_considered": False})
        )

        ml_multiplier = 1.0 + (float(ml_risk_score) / 100.0) * 0.5 if ml_risk_score is not None else 1.0

        total_distance = 0.0
        total_time = 0.0
        total_cost = 0.0
        transport_modes = []
        segments = []
        base_risk_weights = []
        effective_risk_weights = []

        for i in range(len(path) - 1):
            u_node = self._normalize_node_name(path[i])
            v_node = self._normalize_node_name(path[i + 1])
            e_data = self.graph.get_edge_data(u_node, v_node) or {}

            dist = float(e_data.get("distance_km", 0.0))
            time_h = float(e_data.get("base_time_hours", 0.0))
            mode = str(e_data.get("mode", "Multimodal"))
            corridor = str(e_data.get("corridor_name", f"{u_node} -> {v_node} Segment"))
            status = str(e_data.get("status", "Active"))
            base_risk_wt = float(e_data.get("risk_weight", 1.0))
            dynamic_penalty = edge_penalties.get((u_node, v_node), 0.0)
            eff_risk_wt = (base_risk_wt + dynamic_penalty) * ml_multiplier

            if criterion == "distance":
                seg_cost = dist
            elif criterion == "risk_adjusted":
                seg_cost = time_h * eff_risk_wt
            else:
                seg_cost = time_h

            total_distance += dist
            total_time += time_h
            total_cost += seg_cost
            base_risk_weights.append(base_risk_wt)
            effective_risk_weights.append(eff_risk_wt)

            if mode not in transport_modes:
                transport_modes.append(mode)

            segments.append({
                "origin": u_node,
                "destination": v_node,
                "distance_km": round(dist, 1),
                "base_time_hours": round(time_h, 1),
                "mode": mode,
                "corridor_name": corridor,
                "status": status,
                "risk_weight": round(eff_risk_wt, 2),
                "effective_cost": round(seg_cost, 2),
            })

        avg_base_risk = sum(base_risk_weights) / len(base_risk_weights) if base_risk_weights else 1.0
        avg_eff_risk = sum(effective_risk_weights) / len(effective_risk_weights) if effective_risk_weights else 1.0
        max_risk = max(effective_risk_weights) if effective_risk_weights else 1.0

        if max_risk >= 1.50 or avg_eff_risk >= 1.35:
            route_risk_level = "CRITICAL"
        elif max_risk >= 1.25 or avg_eff_risk >= 1.20:
            route_risk_level = "HIGH"
        elif max_risk >= 1.10 or avg_eff_risk >= 1.05:
            route_risk_level = "MEDIUM"
        else:
            route_risk_level = "LOW"

        return {
            "path": path,
            "total_distance_km": round(total_distance, 1),
            "estimated_time_hours": round(total_time, 1),
            "total_cost": round(total_cost, 2),
            "transport_modes": transport_modes,
            "average_risk_weight": round(avg_eff_risk, 2),
            "max_segment_risk_weight": round(max_risk, 2),
            "route_risk_level": route_risk_level,
            "segments": segments,
            "route_geometry": compute_path_geometry_sync(path),
        }

    def get_network_summary(self) -> dict[str, Any]:
        """Summary metrics of the current logistics graph topology."""
        total_nodes = self.graph.number_of_nodes()
        total_edges = self.graph.number_of_edges()

        regions = set()
        modes = set()
        ports_count = 0
        for n_data in self.get_nodes():
            regions.add(n_data.get("region", "Global"))
            if n_data.get("type") == "Port":
                ports_count += 1

        for e_data in self.get_edges():
            modes.add(e_data.get("mode", "Multimodal"))

        return {
            "total_nodes": total_nodes,
            "total_directed_edges": total_edges,
            "regions_covered": sorted(list(regions)),
            "transport_modes": sorted(list(modes)),
            "ports_count": ports_count,
            "networkx_active": NETWORKX_AVAILABLE,
        }


# Global graph network singleton
route_network = SupplyChainRouteNetwork()


def _calc_dist_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometers using the Haversine formula."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(max(0.0, a)), math.sqrt(max(0.0, 1.0 - a)))
    return R * c


async def fetch_osrm_segment(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    client: Optional[Any] = None,
) -> list[list[float]]:
    """
    Call the free OSRM public routing API to fetch real road geometry between two points.
    Only intra-continental road legs under 800 km are queried to prevent transatlantic driving anomalies.
    """
    dist_km = _calc_dist_km(lat1, lon1, lat2, lon2)
    if dist_km > 800.0 or not HTTPX_AVAILABLE or httpx is None:
        return [[lat1, lon1], [lat2, lon2]]

    url = f"https://router.project-osrm.org/route/v1/driving/{lon1:.6f},{lat1:.6f};{lon2:.6f},{lat2:.6f}?overview=full&geometries=geojson"
    try:
        if client is not None:
            resp = await client.get(url)
        else:
            async with httpx.AsyncClient(timeout=2.0) as c:
                resp = await c.get(url)
        if resp.status_code == 200:
            data = resp.json()
            routes = data.get("routes", [])
            if routes and "geometry" in routes[0] and "coordinates" in routes[0]["geometry"]:
                coords = routes[0]["geometry"]["coordinates"]  # [lon, lat]
                if coords and len(coords) >= 2:
                    last_lat, last_lon = coords[-1][1], coords[-1][0]
                    if _calc_dist_km(last_lat, last_lon, lat2, lon2) < 50.0:
                        return [[lat, lon] for lon, lat in coords]
    except Exception as e:
        logger.debug("OSRM segment routing failed for (%s,%s)->(%s,%s): %s", lat1, lon1, lat2, lon2, e)
    return [[lat1, lon1], [lat2, lon2]]


async def compute_path_geometry(path: list[str]) -> list[list[float]]:
    """
    Take the full ordered node path from the Dijkstra route, and for every consecutive pair of nodes,
    call OSRM to get the real road geometry, then concatenate all segments into one continuous ordered coordinate list.
    """
    if not path or len(path) < 2:
        return []

    coords = [route_network.get_node_coordinates(n) for n in path]
    valid_coords = [c for c in coords if c and "lat" in c and "lon" in c]

    if not HTTPX_AVAILABLE or httpx is None:
        return [[c["lat"], c["lon"]] for c in valid_coords]

    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            tasks = []
            for i in range(len(valid_coords) - 1):
                c1 = valid_coords[i]
                c2 = valid_coords[i + 1]
                tasks.append(fetch_osrm_segment(c1["lat"], c1["lon"], c2["lat"], c2["lon"], client=client))

            results = await asyncio.gather(*tasks, return_exceptions=True)
    except Exception:
        results = []
        for i in range(len(valid_coords) - 1):
            c1 = valid_coords[i]
            c2 = valid_coords[i + 1]
            results.append([[c1["lat"], c1["lon"]], [c2["lat"], c2["lon"]]])

    full_geometry = []
    for seg in results:
        if isinstance(seg, Exception) or not seg:
            continue
        if full_geometry and seg and full_geometry[-1] == seg[0]:
            full_geometry.extend(seg[1:])
        elif full_geometry:
            full_geometry.extend(seg)
        else:
            full_geometry.extend(seg)

    return full_geometry


def compute_path_geometry_sync(path: list[str]) -> list[list[float]]:
    """Synchronous instant node coordinate path geometry."""
    if not path or len(path) < 2:
        return []
    coords = [route_network.get_node_coordinates(n) for n in path]
    valid_coords = [c for c in coords if c and "lat" in c and "lon" in c]
    if len(valid_coords) < 2:
        return [[c["lat"], c["lon"]] for c in valid_coords]
    return [[c["lat"], c["lon"]] for c in valid_coords]


class RouteService:
    """Route service combining current status with NetworkX topology foundations and real-time risk intelligence."""

    def __init__(self, network: SupplyChainRouteNetwork = route_network):
        self.network = network

    def alternative(self, shipment_id: str, criterion: str = "risk_adjusted") -> dict | None:
        import time
        t0 = time.time()
        
        shipment = shipment_service.get_shipment(shipment_id)
        if shipment is None:
            return None

        origin_str = shipment.get("origin", "")
        dest_str = shipment.get("destination", "")
        curr_loc_str = shipment.get("current_location", "")

        orig_node = self.network._normalize_node_name(origin_str)
        dest_node = self.network._normalize_node_name(dest_str)

        # 1. Obtain real-time ML risk prediction for the shipment
        ml_risk_score = None
        ml_risk_level = "LOW"
        try:
            from app.services.risk_service import risk_service
            from app.schemas.predictions import RiskPredictionRequest

            pred_req = RiskPredictionRequest(shipment_id=shipment_id, origin=orig_node, destination=dest_node)
            pred_resp = risk_service.predict_risk(pred_req)
            if pred_resp:
                ml_risk_score = pred_resp.risk_score
                ml_risk_level = pred_resp.risk_level
        except Exception:
            ml_risk_score = shipment.get("risk_score", 45)
            ml_risk_level = shipment.get("risk_level", "Medium").upper()

        # 2. Baseline primary route: calculate baseline scheduled path (least time)
        try:
            primary_opt = self.network.dijkstra_shortest_path(orig_node, dest_node, criterion="time", use_realtime_disruptions=False)
            primary_path = primary_opt["path"]
        except Exception:
            primary_path = [orig_node, dest_node]

        # 3. Evaluate the primary/current route's performance and risk under ACTIVE live disruptions
        primary_live_metrics = self.network.compute_path_metrics(
            primary_path,
            criterion=criterion,
            ml_risk_score=ml_risk_score,
            use_realtime_disruptions=True,
        )
        current_route_risk = primary_live_metrics["average_risk_weight"]
        current_route_cost = primary_live_metrics["total_cost"]

        # 4. Calculate optimal recommended path under selected criterion with live disruptions
        try:
            opt_details = self.network.dijkstra_shortest_path(
                orig_node,
                dest_node,
                criterion=criterion,
                ml_risk_score=ml_risk_score,
                use_realtime_disruptions=True,
            )
            recommended_path = opt_details["path"]
        except Exception:
            recommended_path = primary_path
            opt_details = {
                "total_distance_km": primary_live_metrics["total_distance_km"],
                "estimated_time_hours": primary_live_metrics["estimated_time_hours"],
                "total_cost": current_route_cost,
                "average_risk_weight": current_route_risk,
                "route_risk_level": "LOW",
                "transport_modes": ["Multimodal"],
                "segments": primary_live_metrics["segments"],
                "route_geometry": primary_live_metrics.get("route_geometry", []),
                "external_disruptions_considered": False,
                "weather_disruption_count": 0,
                "port_disruption_count": 0,
                "traffic_disruption_count": 0,
                "route_risk_before": current_route_risk,
                "route_risk_after": current_route_risk,
                "dynamic_risk_penalty": 0.0,
                "decision_reason": "Optimal path computed via NetworkX Dijkstra",
                "data_sources": [],
                "is_mock_fallback_used": False,
            }

        recommended_route_risk = opt_details.get("average_risk_weight", current_route_risk)
        recommended_route_cost = opt_details.get("total_cost", current_route_cost)

        # 5. Determine whether recommended route is strictly safer or already optimal
        is_strictly_safer = (recommended_path != primary_path) and (
            recommended_route_risk < current_route_risk - 0.005 or
            (criterion == "risk_adjusted" and recommended_route_cost < current_route_cost - 0.1)
        )
        risk_reduction = round(max(0.0, current_route_risk - recommended_route_risk), 2)
        delta_penalty = round(recommended_route_risk - current_route_risk, 2)

        # 6. Formulate intelligent decision reasoning
        if is_strictly_safer:
            avoided_nodes = [n for n in primary_path if n not in recommended_path and n not in [orig_node, dest_node]]
            avoided_str = f"avoiding {', '.join(avoided_nodes)} bottleneck" if avoided_nodes else "utilizing alternative corridor"
            reason = (
                f"Risk-adjusted Dijkstra selected resilient path {recommended_path} ({avoided_str}) "
                f"to mitigate active operational disruption risk. Reduces route risk exposure from {current_route_risk:.2f}x to {recommended_route_risk:.2f}x "
                f"(↓{risk_reduction:.2f}x safer, ML Risk: {ml_risk_score}/100, Tier: {ml_risk_level})."
            )
        elif recommended_path != primary_path:
            if criterion == "distance":
                reason = f"Dijkstra shortest geographical route selected: {recommended_path} (Total distance: {opt_details.get('total_distance_km', 0.0):.1f} km)."
            elif criterion == "time":
                reason = f"Dijkstra fastest scheduled transit route selected: {recommended_path} (Total estimated time: {opt_details.get('estimated_time_hours', 0.0):.1f} hrs)."
            else:
                reason = (
                    f"Risk-adjusted Dijkstra verified current route {recommended_path} as most resilient path "
                    f"(Effective risk factor: {recommended_route_risk:.2f}x, Cost: {recommended_route_cost:.1f})."
                )
        else:
            reason = (
                f"Risk-adjusted Dijkstra verified current route {recommended_path} as optimal and resilient "
                f"(Effective risk factor: {recommended_route_risk:.2f}x, Effective cost: {recommended_route_cost:.1f}, ML Risk: {ml_risk_score}/100)."
            )

        duration_ms = (time.time() - t0) * 1000.0

        # Observability & Audit Logging
        try:
            from app.core.database import audit_logger, metrics_tracker
            metrics_tracker.record_routing(criterion=criterion, success=True, duration_ms=duration_ms)
            audit_logger.record_event(
                event_type="ALTERNATIVE_ROUTE_RECOMMENDATION",
                shipment_id=shipment["shipment_id"],
                criterion=criterion,
                risk_score=ml_risk_score,
                outcome="SUCCESS",
                details={
                    "recommended_route": recommended_path,
                    "reason": reason,
                    "route_risk_before": current_route_risk,
                    "route_risk_after": recommended_route_risk,
                    "is_strictly_safer": is_strictly_safer,
                    "risk_reduction": risk_reduction,
                },
            )
        except Exception:
            pass

        return {
            "shipment_id": shipment["shipment_id"],
            "origin": orig_node,
            "destination": dest_node,
            "current_route": primary_path,
            "recommended_route": recommended_path,
            "total_distance_km": opt_details.get("total_distance_km"),
            "estimated_time_hours": opt_details.get("estimated_time_hours"),
            "total_cost": opt_details.get("total_cost"),
            "average_risk_weight": opt_details.get("average_risk_weight"),
            "route_risk_level": opt_details.get("route_risk_level"),
            "transport_modes": opt_details.get("transport_modes"),
            "segments": opt_details.get("segments"),
            "reason": reason,
            "algorithm": "NETWORKX_DIJKSTRA",
            "route_geometry": opt_details.get("route_geometry") or compute_path_geometry_sync(recommended_path),
            "ml_risk_score": ml_risk_score,
            "ml_risk_level": ml_risk_level,
            "external_disruptions_considered": opt_details.get("external_disruptions_considered", True),
            "weather_disruption_count": opt_details.get("weather_disruption_count", 0),
            "port_disruption_count": opt_details.get("port_disruption_count", 0),
            "traffic_disruption_count": opt_details.get("traffic_disruption_count", 0),
            "route_risk_before": round(current_route_risk, 2),
            "route_risk_after": round(recommended_route_risk, 2),
            "dynamic_risk_penalty": delta_penalty,
            "is_strictly_safer": is_strictly_safer,
            "risk_reduction": risk_reduction,
            "decision_reason": reason,
            "data_sources": opt_details.get("data_sources", []),
            "is_mock_fallback_used": opt_details.get("is_mock_fallback_used", False),
        }

    def optimize_route(
        self,
        origin: str,
        destination: str,
        criterion: str = "time",
        avoid_nodes: Optional[list[str]] = None,
        ml_risk_score: Optional[int] = None,
    ) -> dict:
        """Calculate the shortest/optimal route directly between any two locations with real-time disruption awareness and Redis caching."""
        import time
        t0 = time.time()

        # Check route cache
        avoid_str = ",".join(sorted(avoid_nodes or []))
        cache_key = f"route:opt:{origin.lower()}:{destination.lower()}:{criterion}:{ml_risk_score}:{avoid_str}"
        try:
            from app.core.config import redis_cache
            cached_route = redis_cache.get(cache_key)
            if cached_route and isinstance(cached_route, dict):
                return cached_route
        except Exception:
            pass

        try:
            res = self.network.dijkstra_shortest_path(
                origin=origin,
                destination=destination,
                criterion=criterion,
                avoid_nodes=avoid_nodes,
                ml_risk_score=ml_risk_score,
                use_realtime_disruptions=True,
            )
            duration_ms = (time.time() - t0) * 1000.0

            # Store in cache
            try:
                from app.core.config import redis_cache
                route_ttl = int(os.getenv("REDIS_ROUTE_CACHE_TTL", "120"))
                redis_cache.set(cache_key, res, ttl=route_ttl)
            except Exception:
                pass

            try:
                from app.core.database import audit_logger, metrics_tracker
                metrics_tracker.record_routing(criterion=criterion, success=True, duration_ms=duration_ms)
                audit_logger.record_event(
                    event_type="ROUTE_OPTIMIZATION",
                    criterion=criterion,
                    outcome="SUCCESS",
                    details={"origin": origin, "destination": destination, "path": res.get("path")},
                )
            except Exception:
                pass
            return res
        except Exception as e:
            duration_ms = (time.time() - t0) * 1000.0
            try:
                from app.core.database import audit_logger, metrics_tracker
                metrics_tracker.record_routing(criterion=criterion, success=False, duration_ms=duration_ms)
                audit_logger.record_event(
                    event_type="ROUTE_OPTIMIZATION_ERROR",
                    criterion=criterion,
                    outcome="FAILED",
                    details={"origin": origin, "destination": destination, "error": str(e)},
                )
            except Exception:
                pass
            raise e

    def simulate_what_if(
        self,
        origin: Optional[str] = None,
        destination: Optional[str] = None,
        shipment_id: Optional[str] = None,
        simulated_mode: Optional[str] = None,
        weather_severity: Optional[float] = None,
        port_congestion: Optional[float] = None,
        customs_risk: Optional[float] = None,
        priority_level: Optional[str] = None,
        sla_days_delta: Optional[float] = 0.0,
        avoid_nodes: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """
        Interactive What-If Scenario Simulation Engine.
        Simulates operational perturbations (transport mode shifts, weather disruptions,
        port congestion, customs inspection, SLA changes) and calculates dynamic route
        alternatives, travel metrics, and dual-model (GNN + XGBoost) cognitive risk impacts.
        """
        from app.services.gnn_service import gnn_service
        from app.services.risk_service import risk_service
        from app.schemas.predictions import RiskPredictionRequest

        # Resolve Origin and Destination
        orig_resolved = origin
        dest_resolved = destination
        shipment_obj = None

        if shipment_id:
            shipment_obj = shipment_service.get_shipment_by_id(shipment_id)
            if shipment_obj:
                s_dict = shipment_obj.to_dict() if hasattr(shipment_obj, "to_dict") else dict(shipment_obj)
                if not orig_resolved:
                    orig_resolved = s_dict.get("origin_location") or s_dict.get("origin") or "Shanghai"
                if not dest_resolved:
                    dest_resolved = s_dict.get("destination_location") or s_dict.get("destination") or "Long_Beach"

        if not orig_resolved:
            orig_resolved = "Shanghai"
        if not dest_resolved:
            dest_resolved = "Long_Beach"

        orig_clean = self.network._normalize_node_name(orig_resolved)
        dest_clean = self.network._normalize_node_name(dest_resolved)

        # 1. Baseline Route & Metrics
        baseline_route = self.network.dijkstra_shortest_path(
            origin=orig_clean,
            destination=dest_clean,
            criterion="time",
            avoid_nodes=None,
            use_realtime_disruptions=False,
        )

        baseline_tx = {
            "origin": orig_clean,
            "destination": dest_clean,
            "transport_mode": "Ocean" if "Ocean" in baseline_route["transport_modes"] else "Road",
            "route_distance_km": baseline_route["total_distance_km"],
            "planned_duration_hours": baseline_route["estimated_time_hours"],
            "weather_severity_index": 15.0,
            "origin_port_congestion_index": 25.0,
            "dest_port_congestion_index": 25.0,
            "customs_inspection_risk": 0.20,
            "carrier_reliability_score": 0.90,
            "priority_level": "Standard",
        }
        if shipment_obj:
            s_dict = shipment_obj.to_dict() if hasattr(shipment_obj, "to_dict") else dict(shipment_obj)
            for k in ["transport_mode", "weather_severity_index", "origin_port_congestion_index", "dest_port_congestion_index", "customs_inspection_risk", "priority_level"]:
                if s_dict.get(k) is not None:
                    baseline_tx[k] = s_dict[k]

        baseline_gnn = gnn_service.predict_gnn_risk(baseline_tx)
        baseline_xgb_score = 50
        try:
            req_xgb = RiskPredictionRequest(
                shipment_id=shipment_id,
                origin=orig_clean,
                destination=dest_clean,
                transport_mode=baseline_tx.get("transport_mode", "Ocean"),
                route_distance_km=baseline_route["total_distance_km"],
                planned_duration_hours=baseline_route["estimated_time_hours"],
            )
            xgb_res = risk_service.predict_risk(req_xgb)
            if xgb_res:
                baseline_xgb_score = xgb_res.risk_score
        except Exception:
            pass

        baseline_fused_prob = 0.55 * baseline_gnn["risk_probability"] + 0.45 * (baseline_xgb_score / 100.0)
        baseline_fused_score = int(round(baseline_fused_prob * 100))
        baseline_fused_tier = "CRITICAL" if baseline_fused_score >= 75 else ("HIGH" if baseline_fused_score >= 55 else ("MEDIUM" if baseline_fused_score >= 35 else "LOW"))

        # 2. Simulated Perturbations & Route Optimization
        sim_weather = weather_severity if weather_severity is not None else float(baseline_tx.get("weather_severity_index", 15.0))
        sim_port = port_congestion if port_congestion is not None else float(baseline_tx.get("origin_port_congestion_index", 25.0))
        sim_customs = customs_risk if customs_risk is not None else float(baseline_tx.get("customs_inspection_risk", 0.20))
        sim_priority = priority_level or baseline_tx.get("priority_level", "Standard")
        sim_mode = simulated_mode or baseline_tx.get("transport_mode", "Ocean")
        sla_delta = float(sla_days_delta or 0.0)

        # Dynamic Dijkstra with simulated conditions & avoid_nodes
        sim_risk_ml = int(round((sim_weather / 100.0 * 0.4 + sim_port / 100.0 * 0.4 + sim_customs * 0.2) * 100))
        
        simulated_route = self.network.dijkstra_shortest_path(
            origin=orig_clean,
            destination=dest_clean,
            criterion="risk_adjusted",
            avoid_nodes=avoid_nodes,
            ml_risk_score=sim_risk_ml,
            use_realtime_disruptions=True,
        )

        sim_tx = {
            "origin": orig_clean,
            "destination": dest_clean,
            "transport_mode": sim_mode,
            "route_distance_km": simulated_route["total_distance_km"],
            "planned_duration_hours": max(4.0, simulated_route["estimated_time_hours"] + (sla_delta * 24.0)),
            "weather_severity_index": sim_weather,
            "origin_port_congestion_index": sim_port,
            "dest_port_congestion_index": sim_port,
            "customs_inspection_risk": sim_customs,
            "carrier_reliability_score": 0.95 if sim_priority == "Urgent" else 0.85,
            "priority_level": sim_priority,
        }

        sim_gnn = gnn_service.predict_gnn_risk(sim_tx)
        sim_xgb_score = 50
        try:
            req_sim_xgb = RiskPredictionRequest(
                shipment_id=shipment_id,
                origin=orig_clean,
                destination=dest_clean,
                transport_mode=sim_mode if sim_mode in ["Air", "Ocean", "Rail", "Road"] else "Ocean",
                route_distance_km=simulated_route["total_distance_km"],
                planned_duration_hours=sim_tx["planned_duration_hours"],
                weather_severity_index=sim_weather,
                origin_port_congestion_index=sim_port,
                dest_port_congestion_index=sim_port,
                customs_inspection_risk=sim_customs,
                priority_level=sim_priority if sim_priority in ["Standard", "High", "Urgent"] else "Standard",
            )
            sim_xgb_res = risk_service.predict_risk(req_sim_xgb)
            if sim_xgb_res:
                sim_xgb_score = sim_xgb_res.risk_score
        except Exception:
            pass

        sim_fused_prob = 0.55 * sim_gnn["risk_probability"] + 0.45 * (sim_xgb_score / 100.0)
        sim_fused_score = int(round(sim_fused_prob * 100))
        sim_fused_tier = "CRITICAL" if sim_fused_score >= 75 else ("HIGH" if sim_fused_score >= 55 else ("MEDIUM" if sim_fused_score >= 35 else "LOW"))

        # 3. Compute Delta Comparisons
        risk_score_delta = sim_fused_score - baseline_fused_score
        time_delta_hours = round(simulated_route["estimated_time_hours"] - baseline_route["estimated_time_hours"], 1)
        dist_delta_km = round(simulated_route["total_distance_km"] - baseline_route["total_distance_km"], 1)
        cost_delta_pct = round(((simulated_route["total_cost"] - baseline_route["total_cost"]) / max(1.0, baseline_route["total_cost"])) * 100.0, 1)

        if risk_score_delta <= -15:
            feasibility = "HIGHLY_RECOMMENDED"
            rec = f"Simulated configuration achieves significant risk reduction of {abs(risk_score_delta)} points. Recommended for active execution."
        elif risk_score_delta < 0:
            feasibility = "FAVORABLE_TRADE_OFF"
            rec = f"Moderate risk reduction of {abs(risk_score_delta)} points achieved with {abs(time_delta_hours)}h transit variance."
        elif risk_score_delta == 0:
            feasibility = "NEUTRAL"
            rec = "Simulated scenario maintains equivalent operational risk profile."
        else:
            feasibility = "ELEVATED_EXPOSURE"
            rec = f"Simulated conditions increase disruption vulnerability (+{risk_score_delta} risk points). Consider alternative routing or buffer margin."

        return {
            "shipment_id": shipment_id,
            "origin": orig_clean,
            "destination": dest_clean,
            "baseline": {
                "path": baseline_route["path"],
                "total_distance_km": baseline_route["total_distance_km"],
                "estimated_time_hours": baseline_route["estimated_time_hours"],
                "transport_modes": baseline_route["transport_modes"],
                "fused_risk_score": baseline_fused_score,
                "fused_risk_tier": baseline_fused_tier,
                "gnn_risk_score": baseline_gnn["risk_score"],
                "xgboost_risk_score": baseline_xgb_score,
                "effective_cost": baseline_route["total_cost"],
                "route_geometry": baseline_route.get("route_geometry", []),
            },
            "simulated": {
                "path": simulated_route["path"],
                "total_distance_km": simulated_route["total_distance_km"],
                "estimated_time_hours": simulated_route["estimated_time_hours"],
                "transport_modes": simulated_route["transport_modes"],
                "fused_risk_score": sim_fused_score,
                "fused_risk_tier": sim_fused_tier,
                "gnn_risk_score": sim_gnn["risk_score"],
                "xgboost_risk_score": sim_xgb_score,
                "effective_cost": simulated_route["total_cost"],
                "route_geometry": simulated_route.get("route_geometry", []),
            },
            "delta": {
                "risk_score_delta": risk_score_delta,
                "time_delta_hours": time_delta_hours,
                "distance_delta_km": dist_delta_km,
                "cost_delta_pct": cost_delta_pct,
                "is_risk_reduced": risk_score_delta < 0,
            },
            "feasibility_status": feasibility,
            "recommendation": rec,
            "parameter_adjustments": {
                "simulated_mode": sim_mode,
                "weather_severity": sim_weather,
                "port_congestion": sim_port,
                "customs_risk": sim_customs,
                "priority_level": sim_priority,
                "sla_days_delta": sla_delta,
                "avoid_nodes": avoid_nodes or [],
            }
        }


route_service = RouteService()

