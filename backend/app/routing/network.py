"""
Supply Chain Route Network Foundation using NetworkX.

Builds a multimodal directed graph representing global supply chain logistics hubs,
ports, airports, intermodal rail terminals, and transit corridors.
"""

from typing import Any, Optional, Union
import math

try:
    import networkx as nx
    NETWORKX_AVAILABLE = True
except ImportError:
    NETWORKX_AVAILABLE = False


# Standard Global Supply Chain Nodes
DEFAULT_NODES = {
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
DEFAULT_EDGES = [
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
        # Reverse direction with symmetrical attributes
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


route_network = SupplyChainRouteNetwork()
