import { useEffect, useRef, useState, useMemo } from 'react'
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Info,
  X,
  Network,
  Activity,
  ShieldCheck,
  ArrowRight,
  Compass,
  Radio,
  Layers,
  MapPin,
  TrendingUp
} from 'lucide-react'
import './Network3DVisual.css'

// ============================================================================
// 33 Representative Logistics Hubs in 4 Distinct 3D Regional Spatial Layers
// Layered across X, Y, and Z axes to create authentic 3D depth
// ============================================================================
export const NETWORK_NODES_3D = [
  // --------------------------------------------------------------------------
  // CLUSTER 1: North American Network (0 - 9)
  // Region: 'North American Network', Group: 'na'
  // Depth Layer: Mid-to-Back Western Flank (Z: -125 to 25, X: -335 to -155)
  // --------------------------------------------------------------------------
  {
    id: 'LAX',
    name: 'Los Angeles',
    country: 'US',
    x: -310, y: 30, z: -70,
    group: 'na',
    radius: 8.2,
    isGateway: true,
    riskScore: 65,
    riskLevel: 'High',
    type: 'Pacific Gateway Mega-Port',
    region: 'North American Network',
    modality: 'Deepwater Maritime & Transcon Rail',
    insight: 'Primary Pacific gateway handling 40% of container imports. High structural congestion; GCN model recommends dynamic diversion via Seattle Great Circle corridor.'
  },
  {
    id: 'LGB',
    name: 'Long Beach',
    country: 'US',
    x: -290, y: 75, z: -45,
    group: 'na',
    radius: 5.5,
    isGateway: false,
    riskScore: 88,
    riskLevel: 'Critical',
    type: 'San Pedro Bay Container Terminal',
    region: 'North American Network',
    modality: 'Automated Container Terminal',
    insight: 'Berth turnaround delays exceeding 72h. Multi-hop cascading backpressure impacts Chicago-bound rail manifests.'
  },
  {
    id: 'OAK',
    name: 'Oakland',
    country: 'US',
    x: -335, y: -20, z: -90,
    group: 'na',
    radius: 5.2,
    isGateway: false,
    riskScore: 48,
    riskLevel: 'Medium',
    type: 'Northern California Port',
    region: 'North American Network',
    modality: 'Maritime & Agricultural Export Depot',
    insight: 'Key agricultural export terminal with balanced throughput. Stable 1-hop buffer to West Coast maritime trunks.'
  },
  {
    id: 'SEA',
    name: 'Seattle',
    country: 'US',
    x: -320, y: -105, z: -125,
    group: 'na',
    radius: 5.6,
    isGateway: false,
    riskScore: 38,
    riskLevel: 'Low',
    type: 'Pacific Northwest Intermodal',
    region: 'North American Network',
    modality: 'Great Circle Maritime & Northern Rail',
    insight: 'Low-congestion alternative gateway. 18% lower transit latency for trans-Pacific electronics shipments.'
  },
  {
    id: 'CHI',
    name: 'Chicago',
    country: 'US',
    x: -220, y: -50, z: -20,
    group: 'na',
    radius: 7.8,
    isGateway: true,
    riskScore: 72,
    riskLevel: 'High',
    type: 'Continental Rail & Logistics Crossroads',
    region: 'North American Network',
    modality: 'Class-I Intermodal Rail Interchange',
    insight: "North America's highest volume rail junction. High seasonal weather sensitivity with significant downstream shock transmission."
  },
  {
    id: 'DAL',
    name: 'Dallas',
    country: 'US',
    x: -245, y: 35, z: -35,
    group: 'na',
    radius: 5.2,
    isGateway: false,
    riskScore: 32,
    riskLevel: 'Low',
    type: 'Inland Distribution Center',
    region: 'North American Network',
    modality: 'Interstate Highway & Air Cargo',
    insight: 'Central inland distribution anchor. High on-time fulfillment rates across southern domestic freight corridors.'
  },
  {
    id: 'HOU',
    name: 'Houston',
    country: 'US',
    x: -225, y: 85, z: -10,
    group: 'na',
    radius: 5.5,
    isGateway: false,
    riskScore: 46,
    riskLevel: 'Medium',
    type: 'Gulf Petrochemical Gateway',
    region: 'North American Network',
    modality: 'Deepwater Channel & Pipeline Depot',
    insight: 'Gulf Coast heavy industrial port. Moderate vulnerability to tropical weather disruptions and channel draft restrictions.'
  },
  {
    id: 'NYC',
    name: 'New York',
    country: 'US',
    x: -155, y: -65, z: 25,
    group: 'na',
    radius: 7.8,
    isGateway: true,
    riskScore: 56,
    riskLevel: 'Medium',
    type: 'East Coast Mega-Port & Air Cargo',
    region: 'North American Network',
    modality: 'JFK Air Cargo & NY/NJ Marine Terminals',
    insight: 'Atlantic maritime gateway with high urban throughput. Serves dense northeastern consumer consumption grid.'
  },
  {
    id: 'SAV',
    name: 'Savannah',
    country: 'US',
    x: -175, y: 35, z: 15,
    group: 'na',
    radius: 5.2,
    isGateway: false,
    riskScore: 36,
    riskLevel: 'Low',
    type: 'Southeast Container Terminal',
    region: 'North American Network',
    modality: 'Deepwater Container Port & CSX/NS Rail',
    insight: 'Fast-growing Southeast logistics corridor. Demonstrates strong buffer capacity during Northeast weather surges.'
  },
  {
    id: 'TOR',
    name: 'Toronto',
    country: 'CA',
    x: -185, y: -110, z: -15,
    group: 'na',
    radius: 5.4,
    isGateway: false,
    riskScore: 28,
    riskLevel: 'Low',
    type: 'Great Lakes Rail Terminal',
    region: 'North American Network',
    modality: 'CN/CP Rail & Trans-Border Trucking',
    insight: 'Cross-border manufacturing supply link. Highly stable bilateral automotive and equipment supply flows.'
  },

  // --------------------------------------------------------------------------
  // CLUSTER 2: European Network (10 - 16)
  // Region: 'European Network', Group: 'europe'
  // Depth Layer: Mid-North Tier (Z: 10 to 95, Y: -165 to -35, X: -140 to -10)
  // --------------------------------------------------------------------------
  {
    id: 'RTM',
    name: 'Rotterdam',
    country: 'NL',
    x: -70, y: -140, z: 75,
    group: 'europe',
    radius: 8.2,
    isGateway: true,
    riskScore: 76,
    riskLevel: 'High',
    type: 'European Mainport Gateway',
    region: 'European Network',
    modality: 'Deepwater Maritime & Rhine Barge Hub',
    insight: 'Main European container gateway with high river-rail feeder dependency. Congestion cascades into Frankfurt air cargo and Antwerp terminals.'
  },
  {
    id: 'ANR',
    name: 'Antwerp',
    country: 'BE',
    x: -115, y: -105, z: 55,
    group: 'europe',
    radius: 5.4,
    isGateway: false,
    riskScore: 45,
    riskLevel: 'Medium',
    type: 'Chemical & Container Port',
    region: 'European Network',
    modality: 'Inland Scheldt Port & Rail Hub',
    insight: 'Leading European chemical port cluster. High throughput efficiency with robust multimodal rail connections.'
  },
  {
    id: 'HAM',
    name: 'Hamburg',
    country: 'DE',
    x: -30, y: -165, z: 95,
    group: 'europe',
    radius: 5.8,
    isGateway: false,
    riskScore: 58,
    riskLevel: 'Medium',
    type: 'Elbe River Port & Rail Hub',
    region: 'European Network',
    modality: 'Tidal River Port & Scandinavian Rail Gateway',
    insight: 'Central Baltic and Scandinavian rail nexus. Subject to seasonal Elbe navigational draft constraints.'
  },
  {
    id: 'FRA',
    name: 'Frankfurt',
    country: 'DE',
    x: -20, y: -95, z: 45,
    group: 'europe',
    radius: 7.6,
    isGateway: true,
    riskScore: 44,
    riskLevel: 'Medium',
    type: 'Air Cargo Mega-Hub & Central Rail',
    region: 'European Network',
    modality: 'Global Airport Hub & Deutsche Bahn Freight',
    insight: 'Core European air cargo junction. Handles high-value pharma, precision machinery, and urgent transshipments.'
  },
  {
    id: 'LON',
    name: 'London',
    country: 'GB',
    x: -140, y: -155, z: 80,
    group: 'europe',
    radius: 5.8,
    isGateway: false,
    riskScore: 39,
    riskLevel: 'Low',
    type: 'UK Distribution & Gateway',
    region: 'European Network',
    modality: 'London Gateway & Channel Intermodal',
    insight: 'UK island distribution hub. Customs clearance buffer maintains high predictability across channel corridors.'
  },
  {
    id: 'GOA',
    name: 'Genoa',
    country: 'IT',
    x: -10, y: -40, z: 25,
    group: 'europe',
    radius: 5.2,
    isGateway: false,
    riskScore: 35,
    riskLevel: 'Low',
    type: 'Mediterranean Deepwater Terminal',
    region: 'European Network',
    modality: 'Ligurian Sea Maritime & Alpine Rail',
    insight: 'Southern European maritime gate. Connects Mediterranean maritime shipping lanes directly to northern industrial Italy.'
  },
  {
    id: 'VLC',
    name: 'Valencia',
    country: 'ES',
    x: -75, y: -35, z: 10,
    group: 'europe',
    radius: 5.2,
    isGateway: false,
    riskScore: 30,
    riskLevel: 'Low',
    type: 'Iberian Maritime Transshipment',
    region: 'European Network',
    modality: 'Western Mediterranean Container Port',
    insight: 'Strategic transshipment hub for western Mediterranean. Reliable weather profile and consistent vessel scheduling.'
  },

  // --------------------------------------------------------------------------
  // CLUSTER 3: India Regional Network (17 - 24)
  // Region: 'India Regional Network', Group: 'india'
  // Depth Layer: Foreground Tier (Z: 100 to 185, Y: -10 to 165, X: -60 to 85)
  // Focus: NH 16 Economic Spine & Primary Gateways
  // --------------------------------------------------------------------------
  {
    id: 'BOM',
    name: 'Mumbai',
    country: 'IN',
    x: -60, y: 60, z: 120,
    group: 'india',
    radius: 8.2,
    isGateway: true,
    riskScore: 22,
    riskLevel: 'Low',
    type: 'Primary West Coast Gateway (JNPT)',
    region: 'India Regional Network',
    modality: 'JNPT Maritime Port & Dedicated Freight Corridor (DFC)',
    insight: "India's premier maritime container port. Direct feeder for the Western Dedicated Freight Corridor linking western ports to northern manufacturing hubs."
  },
  {
    id: 'DEL',
    name: 'Delhi NCR',
    country: 'IN',
    x: -20, y: -10, z: 100,
    group: 'india',
    radius: 7.2,
    isGateway: true,
    riskScore: 26,
    riskLevel: 'Low',
    type: 'Northern Multimodal Logistics Park',
    region: 'India Regional Network',
    modality: 'Inland Container Depot (ICD Tughlakabad) & Air Cargo',
    insight: 'Northern industrial consumption center. Serves high-density automotive and consumer electronics supply chains.'
  },
  {
    id: 'HYD',
    name: 'Hyderabad',
    country: 'IN',
    x: 0, y: 45, z: 135,
    group: 'india',
    radius: 5.8,
    isGateway: false,
    riskScore: 24,
    riskLevel: 'Low',
    type: 'Air Cargo & Central Pharma Corridor',
    region: 'India Regional Network',
    modality: 'RGIA Air Cargo & Central Highway Nexus',
    insight: 'Global pharmaceutical and vaccine export node with temperature-controlled air freight and high SLA reliability.'
  },
  {
    id: 'BZA',
    name: 'Vijayawada',
    country: 'IN',
    x: 35, y: 75, z: 170,
    group: 'india',
    radius: 8.0,
    isGateway: true,
    riskScore: 16,
    riskLevel: 'Low',
    type: 'Inland Rail & Road Junction (NH 16)',
    region: 'India Regional Network',
    modality: 'NH 16 Highway Corridor & SCR Rail Division',
    insight: 'Core multimodal junction on NH 16 economic corridor. Consolidates freight moving between Kolkata, Chennai, and Hyderabad with low delay probability.'
  },
  {
    id: 'GNT',
    name: 'Guntur',
    country: 'IN',
    x: 10, y: 110, z: 160,
    group: 'india',
    radius: 5.2,
    isGateway: false,
    riskScore: 18,
    riskLevel: 'Low',
    type: 'Agricultural & Freight Terminal',
    region: 'India Regional Network',
    modality: 'Regional Highway & Agritech Depot',
    insight: 'High-volume agricultural commodity terminal. Smooth 1-hop consolidation to Vijayawada railhead and Chennai port.'
  },
  {
    id: 'NLR',
    name: 'Nellore',
    country: 'IN',
    x: 50, y: 135, z: 145,
    group: 'india',
    radius: 5.2,
    isGateway: false,
    riskScore: 15,
    riskLevel: 'Low',
    type: 'NH 16 Expressway Logistics Hub',
    region: 'India Regional Network',
    modality: 'Krishnapatnam Port Feeder & NH 16 Expressway',
    insight: 'Strategic coastal expressway transit hub. Direct feeder access to Krishnapatnam deepwater port and Chennai industrial belt.'
  },
  {
    id: 'MAA',
    name: 'Chennai',
    country: 'IN',
    x: 85, y: 165, z: 130,
    group: 'india',
    radius: 7.6,
    isGateway: true,
    riskScore: 32,
    riskLevel: 'Low',
    type: 'Automotive & Deepwater Port',
    region: 'India Regional Network',
    modality: 'Chennai & Ennore Ports & Southern Railway',
    insight: 'Southern automotive and industrial manufacturing cluster. Key maritime transshipment link to Malacca Strait corridors.'
  },
  {
    id: 'VTZ',
    name: 'Visakhapatnam',
    country: 'IN',
    x: 85, y: 45, z: 185,
    group: 'india',
    radius: 5.6,
    isGateway: false,
    riskScore: 28,
    riskLevel: 'Low',
    type: 'Bay of Bengal Deepwater Port',
    region: 'India Regional Network',
    modality: 'Deepwater Port & Coastal Economic Corridor',
    insight: 'Eastern naval and heavy industrial port. Direct bulk mineral and petroleum transshipment hub along the Bay of Bengal.'
  },

  // --------------------------------------------------------------------------
  // CLUSTER 4: Asia-Pacific Network (25 - 32)
  // Region: 'Asia-Pacific Network', Group: 'asia'
  // Depth Layer: Mid-to-Back Eastern Flank (Z: -120 to 60, X: 175 to 365)
  // --------------------------------------------------------------------------
  {
    id: 'SHA',
    name: 'Shanghai',
    country: 'CN',
    x: 250, y: -45, z: -40,
    group: 'asia',
    radius: 8.5,
    isGateway: true,
    riskScore: 85,
    riskLevel: 'Critical',
    type: 'Mega Maritime Port (Yangshan)',
    region: 'Asia-Pacific Network',
    modality: 'Yangshan Deepwater Automated Terminal',
    insight: "World's busiest container hub. Heavy vessel queues trigger cascading delays across Trans-Pacific and European corridors."
  },
  {
    id: 'SZX',
    name: 'Shenzhen',
    country: 'CN',
    x: 220, y: 25, z: -15,
    group: 'asia',
    radius: 5.8,
    isGateway: false,
    riskScore: 50,
    riskLevel: 'Medium',
    type: 'Pearl River Delta Maritime Gateway',
    region: 'Asia-Pacific Network',
    modality: 'Yantian Container Port & High-Tech Air Freight',
    insight: 'Global high-tech hardware export capital. Rapid turnarounds with high sensitivity to transshipment bottlenecks.'
  },
  {
    id: 'NGB',
    name: 'Ningbo',
    country: 'CN',
    x: 290, y: -15, z: -25,
    group: 'asia',
    radius: 5.5,
    isGateway: false,
    riskScore: 42,
    riskLevel: 'Medium',
    type: 'Deepwater Container Terminal',
    region: 'Asia-Pacific Network',
    modality: 'Zhoushan Port Complex & Rail Terminal',
    insight: 'Major deep-sea bulk and container facility. Provides valuable overflow relief for neighboring Shanghai berths.'
  },
  {
    id: 'HKG',
    name: 'Hong Kong',
    country: 'HK',
    x: 190, y: 60, z: 10,
    group: 'asia',
    radius: 5.8,
    isGateway: false,
    riskScore: 34,
    riskLevel: 'Low',
    type: 'Global Air & Sea Transshipment',
    region: 'Asia-Pacific Network',
    modality: 'HKIA World Air Hub & Kwai Tsing Terminal',
    insight: "World's busiest air cargo airport. Rapid customs and express transshipment corridor across APAC and India."
  },
  {
    id: 'SIN',
    name: 'Singapore',
    country: 'SG',
    x: 175, y: 135, z: 60,
    group: 'asia',
    radius: 8.0,
    isGateway: true,
    riskScore: 68,
    riskLevel: 'High',
    type: 'Global Maritime Straits Hub',
    region: 'Asia-Pacific Network',
    modality: 'Tuas Mega Port & Strait of Malacca Anchor',
    insight: 'Indo-Pacific maritime crossroads. Strategic transshipment bottleneck connecting Asia, India, and European ocean corridors.'
  },
  {
    id: 'SGN',
    name: 'Ho Chi Minh',
    country: 'VN',
    x: 230, y: 95, z: 35,
    group: 'asia',
    radius: 5.2,
    isGateway: false,
    riskScore: 40,
    riskLevel: 'Medium',
    type: 'Manufacturing Port Gateway',
    region: 'Asia-Pacific Network',
    modality: 'Cai Mep Deepwater Terminal',
    insight: 'Rapidly expanding Southeast Asian electronics and apparel manufacturing hub with direct US West Coast sailings.'
  },
  {
    id: 'PUS',
    name: 'Busan',
    country: 'KR',
    x: 320, y: -90, z: -80,
    group: 'asia',
    radius: 5.5,
    isGateway: false,
    riskScore: 48,
    riskLevel: 'Medium',
    type: 'Transshipment Hub of Northeast Asia',
    region: 'Asia-Pacific Network',
    modality: 'Busan New Port Deepwater Berths',
    insight: 'Premier Northeast Asian transshipment center. Crucial link for feeder cargo from Northern China, Russia, and Japan.'
  },
  {
    id: 'TYO',
    name: 'Tokyo',
    country: 'JP',
    x: 365, y: -60, z: -120,
    group: 'asia',
    radius: 7.4,
    isGateway: true,
    riskScore: 27,
    riskLevel: 'Low',
    type: 'High-Tech Cargo Gateway',
    region: 'Asia-Pacific Network',
    modality: 'Narita Air Cargo & Yokohama Port',
    insight: 'Precision robotics, automotive parts, and high-value semiconductor supply chain gateway with ultra-high schedule reliability.'
  }
]

// ============================================================================
// 55 Multimodal Freight Corridors with 3 Distinct Connection Types:
// 1. 'local': Thin, subtle intra-cluster line (0.16 alpha)
// 2. 'major': Thicker, brighter intra-cluster logistics arterial (0.38 alpha)
// 3. 'intercontinental': Animated 3D curved arc with moving data pulses
// ============================================================================
export const NETWORK_EDGES_3D = [
  // --- North America Regional Connections (0 - 9) ---
  { u: 0, v: 1, type: 'major', name: 'LA–Long Beach Harbor Arterial' },
  { u: 0, v: 2, type: 'local', name: 'California Coastal Rail' },
  { u: 2, v: 3, type: 'local', name: 'Pacific Northwest Feeder' },
  { u: 0, v: 4, type: 'major', name: 'BNSF Transcon Rail Corridor' },
  { u: 0, v: 5, type: 'major', name: 'I-10 Southwest Freight Trunk' },
  { u: 5, v: 6, type: 'major', name: 'Texas Triangle Petrochem Corridor' },
  { u: 6, v: 8, type: 'local', name: 'Gulf–Atlantic Coastal Route' },
  { u: 4, v: 5, type: 'major', name: 'Central Continental Rail Spine' },
  { u: 4, v: 7, type: 'major', name: 'Midwest–Atlantic Express Rail' },
  { u: 4, v: 9, type: 'local', name: 'Great Lakes Cross-Border Feeder' },
  { u: 7, v: 8, type: 'major', name: 'Eastern Seaboard Intermodal Corridor' },
  { u: 7, v: 9, type: 'local', name: 'Northeast Trans-Border Line' },

  // --- Europe Regional Connections (10 - 16) ---
  { u: 10, v: 11, type: 'major', name: 'Rhine–Scheldt Delta Corridor' },
  { u: 10, v: 12, type: 'major', name: 'North Sea Freight Arterial' },
  { u: 10, v: 13, type: 'major', name: 'Rhine Alpine Industrial Spine' },
  { u: 10, v: 14, type: 'major', name: 'Channel Short-Sea Express' },
  { u: 13, v: 12, type: 'local', name: 'Northern German Rail Link' },
  { u: 13, v: 11, type: 'local', name: 'Central European Feeder' },
  { u: 13, v: 15, type: 'major', name: 'Trans-Alpine Rail Corridor' },
  { u: 15, v: 16, type: 'local', name: 'Western Mediterranean Coastal Route' },
  { u: 11, v: 14, type: 'local', name: 'Scheldt–Thames Feeder' },

  // --- India Regional Network (17 - 24: NH 16 Focus) ---
  { u: 17, v: 18, type: 'major', name: 'Western Dedicated Freight Corridor (DFC)' },
  { u: 17, v: 19, type: 'major', name: 'Mumbai–Hyderabad Industrial Trunk' },
  { u: 17, v: 23, type: 'major', name: 'Trans-Deccan Southern Corridor' },
  { u: 17, v: 20, type: 'major', name: 'Mumbai–Vijayawada Freight Link' },
  { u: 18, v: 19, type: 'local', name: 'North–Central Rail Arterial' },
  { u: 19, v: 20, type: 'major', name: 'NH 65 Hyderabad–Vijayawada Expressway' },
  { u: 20, v: 21, type: 'local', name: 'NH 16 Vijayawada–Guntur Agro Connector' },
  { u: 21, v: 22, type: 'local', name: 'NH 16 Guntur–Nellore Highway Spine' },
  { u: 22, v: 23, type: 'major', name: 'NH 16 Nellore–Chennai Port Expressway' },
  { u: 20, v: 22, type: 'local', name: 'NH 16 Central Andhra Feeder' },
  { u: 20, v: 24, type: 'major', name: 'NH 16 Visakhapatnam Coastal Highway' },
  { u: 20, v: 23, type: 'major', name: 'Vijayawada–Chennai Grand Trunk Rail' },
  { u: 24, v: 23, type: 'local', name: 'Bay of Bengal Coastal Shipping' },

  // --- Asia-Pacific Regional Network (25 - 32) ---
  { u: 25, v: 27, type: 'local', name: 'Yangtze River Delta Feeder' },
  { u: 25, v: 26, type: 'major', name: 'East China Coastal Maritime Trunk' },
  { u: 26, v: 28, type: 'major', name: 'Greater Bay Area Multimodal Link' },
  { u: 28, v: 29, type: 'major', name: 'South China Sea Air/Sea Arterial' },
  { u: 29, v: 30, type: 'local', name: 'Mekong Transshipment Feeder' },
  { u: 26, v: 30, type: 'local', name: 'Pearl River–Vietnam Express' },
  { u: 25, v: 31, type: 'major', name: 'Yellow Sea Maritime Corridor' },
  { u: 31, v: 32, type: 'major', name: 'Korea Strait High-Tech Route' },
  { u: 25, v: 32, type: 'local', name: 'East Sea Express Cargo' },

  // --- Intercontinental Corridors (Curved 3D Arcs + Slow Moving Data Pulses) ---
  { u: 25, v: 0,  type: 'intercontinental', name: 'Trans-Pacific Mega-Trunk (Shanghai ↔ LA)' },
  { u: 32, v: 0,  type: 'intercontinental', name: 'Pacific Great Circle Route (Tokyo ↔ LA)' },
  { u: 31, v: 3,  type: 'intercontinental', name: 'Northern Pacific Gateway (Busan ↔ Seattle)' },
  { u: 26, v: 1,  type: 'intercontinental', name: 'Trans-Pacific Tech Express (Shenzhen ↔ Long Beach)' },
  { u: 29, v: 23, type: 'intercontinental', name: 'Strait of Malacca–Bay of Bengal (Singapore ↔ Chennai)' },
  { u: 29, v: 17, type: 'intercontinental', name: 'Indian Ocean Maritime Highway (Singapore ↔ Mumbai)' },
  { u: 28, v: 24, type: 'intercontinental', name: 'East Asia–Vizag Maritime Bridge (HK ↔ Visakhapatnam)' },
  { u: 17, v: 10, type: 'intercontinental', name: 'Suez Maritime Trunk Corridor (Mumbai ↔ Rotterdam)' },
  { u: 17, v: 15, type: 'intercontinental', name: 'Mediterranean Maritime Route (Mumbai ↔ Genoa)' },
  { u: 18, v: 13, type: 'intercontinental', name: 'Indo-European Air Cargo Bridge (Delhi ↔ Frankfurt)' },
  { u: 10, v: 7,  type: 'intercontinental', name: 'North Atlantic Ocean Highway (Rotterdam ↔ New York)' },
  { u: 14, v: 7,  type: 'intercontinental', name: 'Transatlantic Distribution Trunk (London ↔ New York)' },
  { u: 12, v: 4,  type: 'intercontinental', name: 'Hamburg–Chicago Intermodal Link (Hamburg ↔ Chicago)' },
  { u: 11, v: 8,  type: 'intercontinental', name: 'Antwerp–Savannah Container Express (Antwerp ↔ Savannah)' }
]

// Precompute degree and neighbors map for every node
const NODE_NEIGHBORS = Array.from({ length: NETWORK_NODES_3D.length }, () => [])
NETWORK_EDGES_3D.forEach(({ u, v }) => {
  if (u < NETWORK_NODES_3D.length && v < NETWORK_NODES_3D.length) {
    if (!NODE_NEIGHBORS[u].includes(v)) NODE_NEIGHBORS[u].push(v)
    if (!NODE_NEIGHBORS[v].includes(u)) NODE_NEIGHBORS[v].push(u)
  }
})

// Fixed 3D ambient data particles for authentic motion parallax
const AMBIENT_PARTICLES_3D = [
  { x: -320, y: -120, z: -80, size: 1.1 },
  { x: -240, y: 110, z: -40, size: 1.0 },
  { x: -160, y: -180, z: 60, size: 1.3 },
  { x: -80, y: 140, z: 120, size: 1.0 },
  { x: 30, y: -190, z: 80, size: 1.2 },
  { x: 120, y: 160, z: 140, size: 1.1 },
  { x: 210, y: -130, z: -60, size: 1.0 },
  { x: 310, y: 80, z: -90, size: 1.4 },
  { x: -280, y: 40, z: 100, size: 1.0 },
  { x: 160, y: -60, z: 180, size: 1.2 },
  { x: -50, y: -80, z: -150, size: 1.1 },
  { x: 280, y: 120, z: 30, size: 1.0 },
  { x: -190, y: 20, z: 160, size: 1.2 },
  { x: 70, y: 90, z: -120, size: 1.3 },
  { x: 340, y: -40, z: 70, size: 1.0 },
  { x: -110, y: -140, z: -100, size: 1.2 }
]

// Geometric centers of the 4 regional clusters for volumetric halos
const CLUSTER_CENTERS = [
  { group: 'na', x: -225, y: 0, z: -45, color: 'rgba(251, 191, 36, 0.06)' },
  { group: 'europe', x: -65, y: -105, z: 55, color: 'rgba(192, 132, 252, 0.06)' },
  { group: 'india', x: 25, y: 80, z: 145, color: 'rgba(52, 211, 153, 0.08)' },
  { group: 'asia', x: 260, y: 10, z: -25, color: 'rgba(56, 189, 248, 0.07)' }
]

// Region metadata
const REGION_CONFIG = {
  all: { label: 'All Networks', color: '#38bdf8' },
  india: { label: 'India Regional Network', short: 'India (NH 16)', color: '#34d399', badgeClass: 'india' },
  asia: { label: 'Asia-Pacific Network', short: 'Asia-Pacific', color: '#38bdf8', badgeClass: 'asia' },
  europe: { label: 'European Network', short: 'Europe', color: '#c084fc', badgeClass: 'europe' },
  na: { label: 'North American Network', short: 'North America', color: '#fbbf24', badgeClass: 'na' }
}

export default function Network3DVisual() {
  const canvasRef = useRef(null)
  const [isRotating, setIsRotating] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1.0)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [selectedRegion, setSelectedRegion] = useState('all')

  const hoveredIndexRef = useRef(null)
  const selectedIndexRef = useRef(null)
  const projectedNodesRef = useRef([])
  const zoomLevelRef = useRef(1.0)
  const selectedRegionRef = useRef('all')
  const anglesRef = useRef({ targetY: 0.24, targetX: -0.15, currentY: 0.24, currentX: -0.15 })

  // Keep refs in sync for 60fps render loop
  useEffect(() => {
    zoomLevelRef.current = zoomLevel
  }, [zoomLevel])

  useEffect(() => {
    selectedRegionRef.current = selectedRegion
  }, [selectedRegion])

  useEffect(() => {
    selectedIndexRef.current = selectedNode
      ? NETWORK_NODES_3D.findIndex((n) => n.name === selectedNode.name)
      : null
  }, [selectedNode])

  const handleReset = () => {
    setZoomLevel(1.0)
    setSelectedRegion('all')
    setSelectedNode(null)
    setIsRotating(true)
    anglesRef.current.targetY = 0.24
    anglesRef.current.targetX = -0.15
  }

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(1.7, Number((prev + 0.15).toFixed(2))))
  }

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(0.65, Number((prev - 0.15).toFixed(2))))
  }

  const handleSelectNeighbor = (neighborIndex) => {
    const node = NETWORK_NODES_3D[neighborIndex]
    if (node) {
      setSelectedNode(node)
      setIsRotating(false)
    }
  }

  const handleRegionClick = (regionKey) => {
    setSelectedRegion(regionKey)
    if (regionKey === 'india') {
      anglesRef.current.targetY = 0.08
      anglesRef.current.targetX = -0.12
    } else if (regionKey === 'asia') {
      anglesRef.current.targetY = -0.32
      anglesRef.current.targetX = -0.14
    } else if (regionKey === 'europe') {
      anglesRef.current.targetY = 0.36
      anglesRef.current.targetX = -0.22
    } else if (regionKey === 'na') {
      anglesRef.current.targetY = 0.62
      anglesRef.current.targetX = -0.14
    } else {
      anglesRef.current.targetY = 0.24
      anglesRef.current.targetX = -0.15
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId = null
    let isDragging = false
    let lastMouseX = 0
    let lastMouseY = 0
    let pulseTime = 0

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const onMouseDown = (e) => {
      isDragging = true
      lastMouseX = e.clientX
      lastMouseY = e.clientY
    }

    const onMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - lastMouseX
        const dy = e.clientY - lastMouseY
        lastMouseX = e.clientX
        lastMouseY = e.clientY
        anglesRef.current.targetY += dx * 0.0065
        anglesRef.current.targetX += dy * 0.0065
        anglesRef.current.targetX = Math.max(-0.85, Math.min(0.85, anglesRef.current.targetX))
      } else {
        const rect = canvas.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        let found = null
        for (const node of projectedNodesRef.current) {
          const dist = Math.hypot(node.px - mx, node.py - my)
          if (dist < Math.max(14, node.radius * node.scale + 12)) {
            found = node
            break
          }
        }
        hoveredIndexRef.current = found ? found.index : null
        setHoveredNode(found ? NETWORK_NODES_3D[found.index] : null)
        canvas.style.cursor = found ? 'pointer' : isDragging ? 'grabbing' : 'grab'
      }
    }

    const onMouseUp = () => {
      isDragging = false
    }

    const onClick = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      let clicked = null

      for (const node of projectedNodesRef.current) {
        const dist = Math.hypot(node.px - mx, node.py - my)
        if (dist < Math.max(14, node.radius * node.scale + 12)) {
          clicked = node
          break
        }
      }

      if (clicked) {
        setSelectedNode(NETWORK_NODES_3D[clicked.index])
        setIsRotating(false)
      } else {
        setSelectedNode(null)
      }
    }

    const onWheel = (e) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.08 : -0.08
      setZoomLevel((prev) => Math.max(0.65, Math.min(1.7, Number((prev + delta).toFixed(2)))))
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    // ========================================================================
    // 60FPS Presentation Render Loop
    // ========================================================================
    const render = () => {
      pulseTime += 0.016

      // Slow, dignified auto-orbit: pauses during drag, hover, or hub telemetry inspection
      if (!isDragging && isRotating && !selectedIndexRef.current && hoveredIndexRef.current === null) {
        anglesRef.current.targetY += 0.0005
      }

      // Smooth camera interpolation
      anglesRef.current.currentY += (anglesRef.current.targetY - anglesRef.current.currentY) * 0.08
      anglesRef.current.currentX += (anglesRef.current.targetX - anglesRef.current.currentX) * 0.08

      const angleY = anglesRef.current.currentY
      const angleX = anglesRef.current.currentX

      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      const cx = width / 2
      const cy = height / 2

      // Calibrated 3D focal perspective
      const cameraDistance = 650
      const fov = 590 * zoomLevelRef.current

      ctx.clearRect(0, 0, width, height)

      // Trigonometric cache
      const cosY = Math.cos(angleY), sinY = Math.sin(angleY)
      const cosX = Math.cos(angleX), sinX = Math.sin(angleX)

      // Helper function to project any 3D point (x, y, z) into 2D canvas coordinates
      const project3D = (x, y, z) => {
        const x1 = x * cosY - z * sinY
        const z1 = z * cosY + x * sinY
        const y1 = y * cosX - z1 * sinX
        const z2 = z1 * cosX + y * sinX
        const scale = fov / (cameraDistance + z2)
        return {
          px: cx + x1 * scale,
          py: cy + y1 * scale,
          scale,
          zDepth: z2
        }
      }

      // ----------------------------------------------------------------------
      // A. Draw Subtle 3D Perspective Ground Plane Grid (anchors 3D depth)
      // ----------------------------------------------------------------------
      const floorY = 210
      const gridZ = [-180, -60, 60, 180, 300]
      const gridX = [-360, -180, 0, 180, 360]

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.035)'
      ctx.lineWidth = 1

      // Horizontal ground lines
      gridZ.forEach((gz) => {
        const pA = project3D(-380, floorY, gz)
        const pB = project3D(380, floorY, gz)
        ctx.beginPath()
        ctx.moveTo(pA.px, pA.py)
        ctx.lineTo(pB.px, pB.py)
        ctx.stroke()
      })

      // Longitudinal ground lines
      gridX.forEach((gx) => {
        const pA = project3D(gx, floorY, -190)
        const pB = project3D(gx, floorY, 310)
        ctx.beginPath()
        ctx.moveTo(pA.px, pA.py)
        ctx.lineTo(pB.px, pB.py)
        ctx.stroke()
      })

      // ----------------------------------------------------------------------
      // B. Draw Faint Ambient 3D Data Dust Particles (subtle parallax)
      // ----------------------------------------------------------------------
      AMBIENT_PARTICLES_3D.forEach((part) => {
        const proj = project3D(part.x, part.y, part.z)
        const alpha = Math.max(0.04, Math.min(0.18, 0.14 - proj.zDepth * 0.0003))
        ctx.beginPath()
        ctx.arc(proj.px, proj.py, part.size * proj.scale, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(148, 163, 184, ${alpha})`
        ctx.fill()
      })

      // ----------------------------------------------------------------------
      // C. Draw Volumetric Cluster Halos (Digital Twin regional presence)
      // ----------------------------------------------------------------------
      CLUSTER_CENTERS.forEach((cluster) => {
        const proj = project3D(cluster.x, cluster.y, cluster.z)
        const haloRadius = 140 * proj.scale
        const halo = ctx.createRadialGradient(proj.px, proj.py, 0, proj.px, proj.py, haloRadius)
        halo.addColorStop(0, cluster.color)
        halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(proj.px, proj.py, haloRadius, 0, Math.PI * 2)
        ctx.fill()
      })

      // ----------------------------------------------------------------------
      // D. Project All 33 Hub Nodes into 2D Coordinates
      // ----------------------------------------------------------------------
      const activeFilter = selectedRegionRef.current
      const activeHoverIndex = hoveredIndexRef.current
      const activeSelectIndex = selectedIndexRef.current

      const projectedNodes = NETWORK_NODES_3D.map((node, index) => {
        const proj = project3D(node.x, node.y, node.z)
        const isFiltered = activeFilter === 'all' || node.group === activeFilter
        const isHovered = activeHoverIndex === index
        const isSelected = activeSelectIndex === index
        const isNeighborOfActive =
          (activeHoverIndex !== null && NODE_NEIGHBORS[activeHoverIndex].includes(index)) ||
          (activeSelectIndex !== null && NODE_NEIGHBORS[activeSelectIndex].includes(index))

        return {
          ...node,
          index,
          px: proj.px,
          py: proj.py,
          scale: proj.scale,
          zDepth: proj.zDepth,
          isFiltered,
          isHovered,
          isSelected,
          isNeighborOfActive
        }
      })

      projectedNodesRef.current = projectedNodes

      const hasActiveSelection = activeSelectIndex !== null || activeHoverIndex !== null
      const focusIndex = activeSelectIndex !== null ? activeSelectIndex : activeHoverIndex

      // ----------------------------------------------------------------------
      // E. Render Multimodal Freight Corridors (3 Distinct Visual Styles)
      // ----------------------------------------------------------------------
      NETWORK_EDGES_3D.forEach((edge, edgeIdx) => {
        const p1 = projectedNodes[edge.u]
        const p2 = projectedNodes[edge.v]
        if (!p1 || !p2) return

        const isConnectedToFocus =
          hasActiveSelection && (edge.u === focusIndex || edge.v === focusIndex)

        // Dim unrelated routes when focus is active
        const dimFactor = hasActiveSelection && !isConnectedToFocus ? 0.03 : 1.0
        const isFilterMatch = activeFilter === 'all' || (p1.group === activeFilter && p2.group === activeFilter)
        const filterFactor = !isFilterMatch && activeFilter !== 'all' ? 0.08 : 1.0

        // Depth alpha falloff
        const avgDepth = (p1.zDepth + p2.zDepth) / 2
        const depthAlpha = Math.max(0.3, Math.min(1.1, 1 - avgDepth * 0.0012))

        // --------------------------------------------------------------------
        // Style 1: Intercontinental Connections (Curved 3D Arcs + Data Pulses)
        // --------------------------------------------------------------------
        if (edge.type === 'intercontinental') {
          // Calculate 3D arched control point
          const mx = (NETWORK_NODES_3D[edge.u].x + NETWORK_NODES_3D[edge.v].x) / 2
          const my = (NETWORK_NODES_3D[edge.u].y + NETWORK_NODES_3D[edge.v].y) / 2
          const mz = (NETWORK_NODES_3D[edge.u].z + NETWORK_NODES_3D[edge.v].z) / 2
          const d3d = Math.hypot(
            NETWORK_NODES_3D[edge.u].x - NETWORK_NODES_3D[edge.v].x,
            NETWORK_NODES_3D[edge.u].y - NETWORK_NODES_3D[edge.v].y,
            NETWORK_NODES_3D[edge.u].z - NETWORK_NODES_3D[edge.v].z
          )
          const ctrlX = mx
          const ctrlY = my - d3d * 0.22
          const ctrlZ = mz + d3d * 0.18
          const ctrlProj = project3D(ctrlX, ctrlY, ctrlZ)

          ctx.beginPath()
          ctx.moveTo(p1.px, p1.py)
          ctx.quadraticCurveTo(ctrlProj.px, ctrlProj.py, p2.px, p2.py)

          if (isConnectedToFocus) {
            // Actively focused intercontinental corridor
            ctx.strokeStyle = activeSelectIndex !== null ? '#fbbf24' : '#38bdf8'
            ctx.lineWidth = 2.8
            ctx.shadowColor = activeSelectIndex !== null ? '#fbbf24' : '#38bdf8'
            ctx.shadowBlur = 10
            ctx.stroke()
            ctx.shadowBlur = 0
          } else {
            // Calm, glowing cyber arc
            const baseAlpha = Math.max(0.04, 0.32 * depthAlpha * dimFactor * filterFactor)
            ctx.strokeStyle = `rgba(56, 189, 248, ${baseAlpha})`
            ctx.lineWidth = Math.max(1, 1.4 * ((p1.scale + p2.scale) / 2))
            ctx.stroke()
          }

          // Slow Moving Data Pulse along the 3D arc
          if (!hasActiveSelection || isConnectedToFocus) {
            const t = (pulseTime * 0.1 + (edgeIdx * 0.13)) % 1
            const bx = (1 - t) ** 2 * NETWORK_NODES_3D[edge.u].x + 2 * (1 - t) * t * ctrlX + t ** 2 * NETWORK_NODES_3D[edge.v].x
            const by = (1 - t) ** 2 * NETWORK_NODES_3D[edge.u].y + 2 * (1 - t) * t * ctrlY + t ** 2 * NETWORK_NODES_3D[edge.v].y
            const bz = (1 - t) ** 2 * NETWORK_NODES_3D[edge.u].z + 2 * (1 - t) * t * ctrlZ + t ** 2 * NETWORK_NODES_3D[edge.v].z
            const pulseProj = project3D(bx, by, bz)

            ctx.beginPath()
            ctx.arc(pulseProj.px, pulseProj.py, Math.max(1.8, 2.4 * pulseProj.scale), 0, Math.PI * 2)
            ctx.fillStyle = isConnectedToFocus ? (activeSelectIndex !== null ? '#fbbf24' : '#ffffff') : '#38bdf8'
            ctx.shadowColor = isConnectedToFocus ? '#fbbf24' : '#38bdf8'
            ctx.shadowBlur = 6
            ctx.fill()
            ctx.shadowBlur = 0
          }
        }

        // --------------------------------------------------------------------
        // Style 2 & 3: Local vs Major Intra-Cluster Connections (Straight)
        // --------------------------------------------------------------------
        else {
          ctx.beginPath()
          ctx.moveTo(p1.px, p1.py)
          ctx.lineTo(p2.px, p2.py)

          if (isConnectedToFocus) {
            // Focused intra-cluster route
            ctx.strokeStyle = activeSelectIndex !== null ? '#fbbf24' : '#38bdf8'
            ctx.lineWidth = 2.6
            ctx.shadowColor = activeSelectIndex !== null ? '#fbbf24' : '#38bdf8'
            ctx.shadowBlur = 10
            ctx.stroke()
            ctx.shadowBlur = 0

            // Animated light pulse on focused corridor
            const t = (pulseTime * 0.7 + edgeIdx * 0.2) % 1
            const pulseX = p1.px + (p2.px - p1.px) * t
            const pulseY = p1.py + (p2.py - p1.py) * t

            ctx.beginPath()
            ctx.arc(pulseX, pulseY, 2.5, 0, Math.PI * 2)
            ctx.fillStyle = '#ffffff'
            ctx.shadowColor = activeSelectIndex !== null ? '#fbbf24' : '#38bdf8'
            ctx.shadowBlur = 6
            ctx.fill()
            ctx.shadowBlur = 0
          } else {
            // Style 2: Major Logistics Corridor (Thicker, brighter)
            // Style 3: Local Connection (Thin, subtle solid line)
            const isMajor = edge.type === 'major'
            const baseAlpha = isMajor ? 0.36 : 0.16
            const finalAlpha = Math.max(0.04, baseAlpha * depthAlpha * dimFactor * filterFactor)

            let grpColor = `rgba(56, 189, 248, ${finalAlpha})`
            if (p1.group === 'india') grpColor = `rgba(52, 211, 153, ${finalAlpha})`
            else if (p1.group === 'europe') grpColor = `rgba(192, 132, 252, ${finalAlpha})`
            else if (p1.group === 'na') grpColor = `rgba(251, 191, 36, ${finalAlpha})`

            ctx.strokeStyle = grpColor
            ctx.lineWidth = Math.max(0.8, (isMajor ? 1.9 : 1.0) * ((p1.scale + p2.scale) / 2))
            ctx.stroke()
          }
        }
      })

      // ----------------------------------------------------------------------
      // F. Render 3D Logistics Hub Nodes (Back-to-Front Occlusion)
      // ----------------------------------------------------------------------
      const sortedNodes = [...projectedNodes].sort((a, b) => b.zDepth - a.zDepth)

      sortedNodes.forEach((node) => {
        const isDimmed =
          (hasActiveSelection && !node.isHovered && !node.isSelected && !node.isNeighborOfActive) ||
          (!node.isFiltered && activeFilter !== 'all')

        const baseAlpha = isDimmed ? 0.12 : 1.0
        const depthAlpha = Math.max(0.35, Math.min(1.0, 0.95 - node.zDepth * 0.0014)) * baseAlpha

        const isHighlighted = node.isHovered || node.isSelected
        const scaleMult = isHighlighted ? 1.45 : node.isNeighborOfActive ? 1.2 : node.isGateway ? 1.15 : 0.92
        const nodeRadius = Math.max(3.2, node.radius * node.scale * scaleMult)

        // Regional Theme Colors
        let primaryColor = '#38bdf8'
        let glowColor = 'rgba(56, 189, 248, 0.8)'

        if (node.group === 'india') {
          primaryColor = '#34d399'
          glowColor = 'rgba(52, 211, 153, 0.8)'
        } else if (node.group === 'europe') {
          primaryColor = '#c084fc'
          glowColor = 'rgba(192, 132, 252, 0.8)'
        } else if (node.group === 'na') {
          primaryColor = '#fbbf24'
          glowColor = 'rgba(251, 191, 36, 0.8)'
        }

        // Active Focus Pulse Ring
        if (isHighlighted) {
          const pulseR = nodeRadius + (Math.sin(pulseTime * 4) + 1) * 4.5
          ctx.beginPath()
          ctx.arc(node.px, node.py, pulseR, 0, Math.PI * 2)
          ctx.strokeStyle = node.isSelected ? 'rgba(251, 191, 36, 0.9)' : 'rgba(56, 189, 248, 0.9)'
          ctx.lineWidth = 1.8
          ctx.stroke()
        } else if (node.isGateway && !isDimmed) {
          // Subtle breathing beacon on primary gateway hubs
          const beaconR = nodeRadius + (Math.sin(pulseTime * 2 + node.index) + 1) * 2.2
          ctx.beginPath()
          ctx.arc(node.px, node.py, beaconR, 0, Math.PI * 2)
          ctx.strokeStyle = primaryColor
          ctx.globalAlpha = 0.28 * depthAlpha
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.globalAlpha = 1.0
        }

        // Soft Radial Glow on Gateway Hubs or Highlighted Nodes
        if (!isDimmed && (node.isGateway || isHighlighted || node.isNeighborOfActive)) {
          const glowRadius = nodeRadius * (isHighlighted ? 3.4 : 2.4)
          const glow = ctx.createRadialGradient(node.px, node.py, 0, node.px, node.py, glowRadius)
          glow.addColorStop(0, glowColor)
          glow.addColorStop(1, 'rgba(0,0,0,0)')

          ctx.fillStyle = glow
          ctx.globalAlpha = depthAlpha
          ctx.beginPath()
          ctx.arc(node.px, node.py, glowRadius, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1.0
        }

        // Solid Hub Core
        ctx.beginPath()
        ctx.arc(node.px, node.py, nodeRadius, 0, Math.PI * 2)
        ctx.fillStyle = isHighlighted ? '#ffffff' : primaryColor
        ctx.globalAlpha = depthAlpha
        ctx.fill()

        ctx.strokeStyle = isHighlighted ? (node.isSelected ? '#fbbf24' : '#38bdf8') : '#080d1a'
        ctx.lineWidth = isHighlighted ? 2.2 : 1.2
        ctx.stroke()
        ctx.globalAlpha = 1.0

        // --------------------------------------------------------------------
        // Clean Text Labels (Uncluttered Rules: Major Hubs Only by Default)
        // --------------------------------------------------------------------
        const shouldShowLabel =
          isHighlighted ||
          node.isNeighborOfActive ||
          (node.isGateway && !isDimmed) ||
          (activeFilter === node.group && !isDimmed)

        if (shouldShowLabel && !isDimmed) {
          const labelText = node.isGateway ? `★ ${node.name}` : node.name
          ctx.font = isHighlighted
            ? 'bold 12px "JetBrains Mono", monospace'
            : node.isGateway
            ? '600 10.5px "JetBrains Mono", monospace'
            : '500 9.5px "JetBrains Mono", monospace'

          const textWidth = ctx.measureText(labelText).width
          const labelX = node.px + nodeRadius + 6
          const labelY = node.py + 4

          // High-contrast pill backdrop
          ctx.fillStyle = isHighlighted
            ? 'rgba(11, 17, 32, 0.95)'
            : 'rgba(11, 17, 32, 0.82)'
          ctx.fillRect(labelX - 4, labelY - 11, textWidth + 8, 15)

          ctx.strokeStyle = isHighlighted
            ? (node.isSelected ? '#fbbf24' : '#38bdf8')
            : 'rgba(255, 255, 255, 0.12)'
          ctx.lineWidth = 1
          ctx.strokeRect(labelX - 4, labelY - 11, textWidth + 8, 15)

          ctx.fillStyle = isHighlighted
            ? '#ffffff'
            : node.isNeighborOfActive
            ? '#38bdf8'
            : `rgba(241, 245, 249, ${Math.max(0.7, depthAlpha)})`
          ctx.fillText(labelText, labelX, labelY)
        }
      })

      animationId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resizeCanvas)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [isRotating])

  // Selected hub neighbors data
  const selectedNodeNeighbors = useMemo(() => {
    if (!selectedNode) return []
    const idx = NETWORK_NODES_3D.findIndex((n) => n.name === selectedNode.name)
    if (idx === -1) return []
    return NODE_NEIGHBORS[idx].map((neighborIdx) => ({
      index: neighborIdx,
      ...NETWORK_NODES_3D[neighborIdx]
    }))
  }, [selectedNode])

  const getRiskBadgeClass = (score) => {
    if (score > 75) return 'critical'
    if (score > 50) return 'high'
    if (score > 30) return 'medium'
    return 'low'
  }

  return (
    <div className="network-3d-card" aria-label="3D Graph Neural Network Topology Visualizer">
      {/* Header Bar */}
      <div className="network-3d-header">
        <div className="network-3d-title-group">
          <span className="network-3d-pill">
            <Sparkles size={12} /> 3D GCN TOPOLOGY
          </span>
          <div className="network-3d-headings">
            <span className="network-3d-title">Global Multimodal Freight Graph</span>
            <span className="network-3d-subtitle">
              4 Regional Depth Clusters · N=33 Logistics Hubs · E=55 Corridors · Spectral Laplacian
            </span>
          </div>
        </div>

        {/* Region Filter Buttons */}
        <div className="network-3d-region-filters" role="group" aria-label="Filter freight network by geographic cluster">
          {Object.entries(REGION_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              className={`region-filter-btn ${selectedRegion === key ? 'active' : ''} ${cfg.badgeClass || ''}`}
              onClick={() => handleRegionClick(key)}
            >
              {key !== 'all' && <span className={`filter-dot ${cfg.badgeClass}`} />}
              <span>{cfg.short || cfg.label}</span>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="network-3d-actions">
          <button
            type="button"
            className={`network-3d-btn ${isRotating ? 'active' : ''}`}
            onClick={() => setIsRotating(!isRotating)}
            title={isRotating ? 'Pause Continuous Rotation' : 'Resume Gentle Orbit'}
          >
            {isRotating ? <Pause size={13} /> : <Play size={13} />}
            <span>{isRotating ? 'Orbiting' : 'Paused'}</span>
          </button>

          <button
            type="button"
            className="network-3d-btn"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomIn size={13} />
          </button>

          <button
            type="button"
            className="network-3d-btn"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOut size={13} />
          </button>

          <button
            type="button"
            className="network-3d-btn reset-btn"
            onClick={handleReset}
            title="Reset Perspective, Zoom, and Selection"
          >
            <RotateCcw size={13} />
            <span>Reset View</span>
          </button>

          <span className="network-3d-zoom-badge">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      </div>

      {/* Main 3D Canvas Stage */}
      <div className="network-3d-canvas-wrapper">
        <canvas ref={canvasRef} className="network-3d-canvas" />

        {/* Instructions Hint */}
        <div className="network-3d-hint">
          <Compass size={12} /> Drag to rotate · Scroll to zoom · Click any hub to focus connection topology
        </div>

        {/* Hover Tooltip (Only when side panel is closed) */}
        {hoveredNode && !selectedNode && (
          <div className="network-3d-floating-inspector">
            <div className="inspector-header">
              <span className={`inspector-dot ${hoveredNode.group}`} />
              <div className="inspector-title-row">
                <strong>{hoveredNode.name}</strong>
                <span className="inspector-country-badge">{hoveredNode.country}</span>
              </div>
            </div>
            <div className="inspector-body">
              <span className="inspector-type">{hoveredNode.type}</span>
              <div className="inspector-stats">
                <span className={`inspector-risk-tag ${getRiskBadgeClass(hoveredNode.riskScore)}`}>
                  Risk: {hoveredNode.riskScore}/100 ({hoveredNode.riskLevel})
                </span>
                <span className="inspector-degree-tag">
                  {NODE_NEIGHBORS[NETWORK_NODES_3D.findIndex((n) => n.name === hoveredNode.name)].length} Routes
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Deep Logistics Hub Telemetry Panel (Slides in on Click) */}
        {selectedNode && (
          <aside className="hub-telemetry-panel" aria-label="Logistics Hub Deep Telemetry">
            <div className="telemetry-header">
              <div className="telemetry-badge-row">
                <span className={`telemetry-region-pill ${selectedNode.group}`}>
                  <Radio size={10} className="pulse-icon" /> {selectedNode.region}
                </span>
                <button
                  type="button"
                  className="telemetry-close-btn"
                  onClick={() => setSelectedNode(null)}
                  title="Close Hub Telemetry"
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="telemetry-hub-title-row">
                <h2>{selectedNode.name} Logistics Hub</h2>
                <span className="telemetry-code">{selectedNode.id} · {selectedNode.country}</span>
              </div>
              <span className="telemetry-type">{selectedNode.type}</span>
            </div>

            <div className="telemetry-body">
              {/* Telemetry Summary Cards Grid */}
              <div className="telemetry-summary-grid">
                <div className="telemetry-summary-item">
                  <span className="summary-label">Hub</span>
                  <span className="summary-val">{selectedNode.name}</span>
                </div>
                <div className="telemetry-summary-item">
                  <span className="summary-label">Region</span>
                  <span className="summary-val">{selectedNode.region.split(' ')[0]}</span>
                </div>
                <div className="telemetry-summary-item">
                  <span className="summary-label">Connected Corridors</span>
                  <span className="summary-val highlight-blue">{selectedNodeNeighbors.length} Corridors</span>
                </div>
                <div className="telemetry-summary-item">
                  <span className="summary-label">Network Risk</span>
                  <span className={`summary-risk-pill ${getRiskBadgeClass(selectedNode.riskScore)}`}>
                    {selectedNode.riskLevel} ({selectedNode.riskScore}/100)
                  </span>
                </div>
              </div>

              {/* Risk Gauge Bar */}
              <div className="telemetry-metric-card">
                <div className="metric-row-top">
                  <span className="metric-label">GCN Disruption Vulnerability</span>
                  <span className="metric-sub">{selectedNode.riskScore}/100</span>
                </div>
                <div className="metric-score-bar-wrap">
                  <div
                    className={`metric-score-fill ${getRiskBadgeClass(selectedNode.riskScore)}`}
                    style={{ width: `${selectedNode.riskScore}%` }}
                  />
                </div>
              </div>

              {/* Multimodal Infrastructure */}
              <div className="telemetry-info-box">
                <span className="info-box-title">Multimodal Modality</span>
                <p className="info-box-text">{selectedNode.modality}</p>
              </div>

              {/* Connected Hubs List */}
              <div className="telemetry-neighbors-section">
                <div className="neighbors-header">
                  <Network size={13} />
                  <span>Connected Hubs ({selectedNodeNeighbors.length})</span>
                </div>
                <div className="neighbors-list">
                  {selectedNodeNeighbors.map((neighbor) => (
                    <button
                      key={neighbor.name}
                      type="button"
                      className="neighbor-pill"
                      onClick={() => handleSelectNeighbor(neighbor.index)}
                      title={`Jump focus to ${neighbor.name} (${neighbor.region})`}
                    >
                      <span className={`neighbor-dot ${neighbor.group}`} />
                      <span className="neighbor-name">{neighbor.name}</span>
                      <span className={`neighbor-risk ${getRiskBadgeClass(neighbor.riskScore)}`}>
                        {neighbor.riskScore}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cognitive GCN Topological Assessment */}
              <div className="telemetry-insight-box">
                <div className="insight-box-title">
                  <ShieldCheck size={13} />
                  <span>GCN Supply Chain Topological Assessment</span>
                </div>
                <p className="insight-box-text">{selectedNode.insight}</p>
              </div>
            </div>

            <div className="telemetry-footer">
              <button
                type="button"
                className="telemetry-action-btn"
                onClick={() => handleRegionClick(selectedNode.group)}
              >
                <span>Filter {REGION_CONFIG[selectedNode.group]?.short || 'Region'}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Explanatory description required for presentations */}
      <div className="network-3d-explanation">
        <Info size={16} className="explanation-icon" />
        <p>
          <strong>Global Multimodal Supply Chain Network Topology (4 Geographic Depth Layers):</strong>{' '}
          The 3D graph visualizes <strong>N=33 logistics hubs</strong> and <strong>E=55 multimodal freight corridors</strong> grouped into India Regional (foreground NH 16 spine), Asia-Pacific, European, and North American networks. Major gateway hubs (★) anchor curved intercontinental trade arcs with slow moving data pulses. Clicking any hub isolates its local GCN neighborhood and displays its real-time topological disruption score.
        </p>
      </div>

      {/* Visual Legend Bar */}
      <div className="network-3d-legend">
        <span className="n3d-legend-item">
          <span className="n3d-dot india" /> India Regional (NH 16 Spine)
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-dot asia" /> Asia-Pacific Maritime Gateway
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-dot europe" /> European Intermodal & Rail Network
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-dot na" /> North America Trunk Logistics
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-star">★</span> Major Gateway Hub
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-line-sample major" /> Major Logistics Corridor
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-line-sample local" /> Local Feeder
        </span>
        <span className="n3d-legend-item">
          <span className="n3d-line-sample intercon" /> Intercontinental 3D Arc (Data Pulse)
        </span>
      </div>
    </div>
  )
}
