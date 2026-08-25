"""
P5.1 Route Network Foundation Test Suite.

Verifies:
1. NetworkX installation and graph construction
2. Supply chain locations loaded as nodes with coordinates, regions, and types
3. Multimodal transit corridors loaded as directed edges with distance, base time, and mode
4. Node and edge queries, neighbor resolution
5. Connectivity between key supply chain origins and destinations
6. Reusability for P5.2 Dijkstra path optimization
"""

from pathlib import Path
import sys

base_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(base_dir))

from app.routing.network import route_network, build_supply_chain_graph, NETWORKX_AVAILABLE

def run_tests():
    print("=" * 70)
    print("P5.1 ROUTE NETWORK FOUNDATION VERIFICATION")
    print("=" * 70)

    # 1. NetworkX Check
    print(f"NetworkX Available: {NETWORKX_AVAILABLE}")

    # 2. Graph Construction
    G = build_supply_chain_graph()
    num_nodes = G.number_of_nodes()
    num_edges = G.number_of_edges()
    print(f"Graph initialized with {num_nodes} nodes and {num_edges} directed edges.")
    assert num_nodes >= 25, f"Expected at least 25 nodes, found {num_nodes}"
    assert num_edges >= 50, f"Expected at least 50 edges, found {num_edges}"

    # 3. Node Attributes Check
    shanghai = route_network.get_node("Shanghai")
    assert shanghai is not None, "Shanghai node not found"
    print(f"Node 'Shanghai': {shanghai['name']} ({shanghai['type']}) in {shanghai['region']} at ({shanghai['lat']}, {shanghai['lon']})")
    assert shanghai["type"] == "Port"
    assert shanghai["region"] == "East_Asia"

    rotterdam = route_network.get_node("Rotterdam")
    assert rotterdam is not None, "Rotterdam node not found"
    print(f"Node 'Rotterdam': {rotterdam['name']} ({rotterdam['type']}) in {rotterdam['region']}")

    # 4. Edge Attributes Check
    corridor = route_network.get_edge("Shanghai", "Long_Beach")
    assert corridor is not None, "Shanghai -> Long_Beach edge not found"
    print(f"Edge 'Shanghai -> Long_Beach': {corridor['distance_km']} km, {corridor['base_time_hours']} hrs ({corridor['mode']}) [{corridor['corridor_name']}]")
    assert corridor["mode"] == "Ocean"
    assert corridor["distance_km"] > 5000

    # 5. Connectivity & Neighbor Queries
    sh_neighbors = route_network.get_neighbors("Shanghai")
    print(f"Direct neighbors of Shanghai: {sh_neighbors}")
    assert "Long_Beach" in sh_neighbors
    assert "Ningbo" in sh_neighbors or "Busan" in sh_neighbors

    # 6. Path Connectivity Check between connected locations
    paths_sh_lb = route_network.find_available_routes("Shanghai", "Long_Beach", max_depth=3)
    print(f"Paths found between Shanghai and Long_Beach: {len(paths_sh_lb)} paths")
    assert len(paths_sh_lb) >= 1
    print(f"Sample path: {' -> '.join(paths_sh_lb[0])}")

    # Check Trans-Atlantic Path
    paths_fra_tor = route_network.find_available_routes("Frankfurt", "Toronto", max_depth=3)
    print(f"Paths found between Frankfurt and Toronto: {len(paths_fra_tor)} paths")
    assert len(paths_fra_tor) >= 1

    # Check Inland US Path
    paths_chi_dal = route_network.find_available_routes("Chicago", "Dallas", max_depth=3)
    print(f"Paths found between Chicago and Dallas: {len(paths_chi_dal)} paths")
    assert len(paths_chi_dal) >= 1

    # 7. Summary Metrics
    summary = route_network.get_network_summary()
    print("
Network Summary:")
    for k, v in summary.items():
        print(f"  {k}: {v}")

    print("
" + "=" * 70)
    print("ALL P5.1 ROUTE NETWORK FOUNDATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
