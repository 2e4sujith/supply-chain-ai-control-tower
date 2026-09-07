/**
 * Real Address Resolution & Geocoding Service
 * Provides deterministic hub resolution, in-memory caching, and throttled OpenStreetMap Nominatim geocoding.
 */

// In-memory cache for forward geocoding (query -> resolved location object)
const geocodeCache = new Map()

// In-memory cache for reverse geocoding ("lat,lon" -> readable address object)
const reverseGeocodeCache = new Map()

// Predefined verified supply chain hub locations
export const PREDEFINED_HUBS = {
  Vijayawada: {
    lat: 16.5062,
    lon: 80.6480,
    label: 'Vijayawada Logistics Hub',
    city: 'Vijayawada',
    state: 'Andhra Pradesh',
    country: 'India',
    postcode: '520001',
    road: 'NH 16 / Bandar Road',
    type: 'Inland Rail & Road Hub',
    fullAddress: 'Vijayawada Logistics Hub, NH 16, Krishna District, Andhra Pradesh, 520001, India',
  },
  H_Junction: {
    lat: 16.5683,
    lon: 80.9496,
    label: 'Hanuman Junction (H Junction)',
    city: 'Hanuman Junction',
    state: 'Andhra Pradesh',
    country: 'India',
    postcode: '521105',
    road: 'NH 16 / Eluru Road',
    type: 'Freight Highway Junction',
    fullAddress: 'Hanuman Junction, NH 16 Highway Corridor, Krishna District, Andhra Pradesh, 521105, India',
  },
  Guntur: {
    lat: 16.3067,
    lon: 80.4365,
    label: 'Guntur Logistics Terminal',
    city: 'Guntur',
    state: 'Andhra Pradesh',
    country: 'India',
    postcode: '522002',
    road: 'Guntur - Vijayawada Expressway',
    type: 'Agricultural & Freight Hub',
    fullAddress: 'Guntur Logistics Terminal, Guntur District, Andhra Pradesh, 522002, India',
  },
  Hyderabad: {
    lat: 17.3850,
    lon: 78.4867,
    label: 'Hyderabad Logistics Center',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    postcode: '500001',
    road: 'Outer Ring Road Freight Corridor',
    type: 'Inland Hub & Rail',
    fullAddress: 'Hyderabad Logistics Center, Outer Ring Road, Telangana, 500001, India',
  },
  Visakhapatnam: {
    lat: 17.6868,
    lon: 83.2185,
    label: 'Port of Visakhapatnam',
    city: 'Visakhapatnam',
    state: 'Andhra Pradesh',
    country: 'India',
    postcode: '530035',
    road: 'Port Road / NH 16',
    type: 'Major Deepwater Seaport',
    fullAddress: 'Port of Visakhapatnam, Port Area, Visakhapatnam, Andhra Pradesh, 530035, India',
  },
  Chennai: {
    lat: 13.0827,
    lon: 80.2707,
    label: 'Chennai Port & Hub',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    postcode: '600001',
    road: 'Rajaji Salai / Port Express',
    type: 'Major Container Port',
    fullAddress: 'Chennai Port Trust, Rajaji Salai, Chennai, Tamil Nadu, 600001, India',
  },
  Bengaluru: {
    lat: 12.9716,
    lon: 77.5946,
    label: 'Bengaluru Logistics Gateway',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    postcode: '560001',
    road: 'Hosur Road / Electronic City Corridor',
    type: 'Air Cargo & Tech Hub',
    fullAddress: 'Bengaluru Freight Terminal, Hosur Road, Bengaluru, Karnataka, 560001, India',
  },
  Delhi: {
    lat: 28.6139,
    lon: 77.2090,
    label: 'Delhi NCR Freight Terminal',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    postcode: '110001',
    road: 'Western Peripheral Expressway',
    type: 'Intermodal Logistics Center',
    fullAddress: 'Delhi NCR Intermodal Freight Terminal, Tughlakabad ICD, New Delhi, 110001, India',
  },
  Kolkata: {
    lat: 22.5726,
    lon: 88.3639,
    label: 'Kolkata Port Gateway',
    city: 'Kolkata',
    state: 'West Bengal',
    country: 'India',
    postcode: '700001',
    road: 'Strand Road / Port Corridor',
    type: 'Port & Rail Freight Hub',
    fullAddress: 'Syama Prasad Mookerjee Port, Strand Road, Kolkata, West Bengal, 700001, India',
  },
  Cochin: {
    lat: 9.9312,
    lon: 76.2673,
    label: 'Cochin Transshipment Terminal',
    city: 'Kochi',
    state: 'Kerala',
    country: 'India',
    postcode: '682009',
    road: 'Vallarpadam Terminal Road',
    type: 'International Transshipment',
    fullAddress: 'Vallarpadam International Transshipment Terminal, Kochi, Kerala, 682009, India',
  },
  Ahmedabad: {
    lat: 23.0225,
    lon: 72.5714,
    label: 'Ahmedabad Logistics Hub',
    city: 'Ahmedabad',
    state: 'Gujarat',
    country: 'India',
    postcode: '380001',
    road: 'Sardar Patel Ring Road',
    type: 'Inland Freight Terminal',
    fullAddress: 'Ahmedabad Multimodal Hub, SP Ring Road, Ahmedabad, Gujarat, 380001, India',
  },
  Mundra: {
    lat: 22.8396,
    lon: 69.7042,
    label: 'Port of Mundra',
    city: 'Mundra',
    state: 'Gujarat',
    country: 'India',
    postcode: '370421',
    road: 'Adani Port Road',
    type: 'Commercial Deepwater Port',
    fullAddress: 'Port of Mundra Container Terminal, Kutch District, Gujarat, 370421, India',
  },
  Pune: {
    lat: 18.5204,
    lon: 73.8567,
    label: 'Pune Industrial Freight Hub',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    postcode: '411001',
    road: 'Pune-Mumbai Expressway',
    type: 'Automotive & Industrial Hub',
    fullAddress: 'Pune Logistics Park, Chakan Industrial Area, Pune, Maharashtra, 411001, India',
  },
  Mumbai: {
    lat: 18.9647,
    lon: 72.8258,
    label: 'Nhava Sheva (JNPT Mumbai)',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    country: 'India',
    postcode: '400702',
    road: 'JNPT Port Highway',
    type: 'Container Port',
    fullAddress: 'Jawaharlal Nehru Port Trust (JNPT), Nhava Sheva, Navi Mumbai, Maharashtra, 400702, India',
  },
  Nagpur: {
    lat: 21.1458,
    lon: 79.0882,
    label: 'Nagpur Multi-Modal Hub',
    city: 'Nagpur',
    state: 'Maharashtra',
    country: 'India',
    postcode: '440001',
    road: 'MIHAN Express Corridor',
    type: 'Central Logistics Hub',
    fullAddress: 'MIHAN Multi-modal International Cargo Hub, Nagpur, Maharashtra, 440001, India',
  },
  Rajahmundry: {
    lat: 17.0005,
    lon: 81.8040,
    label: 'Rajahmundry Freight Hub',
    city: 'Rajahmundry',
    state: 'Andhra Pradesh',
    country: 'India',
    postcode: '533101',
    road: 'NH 16 Godavari Corridor',
    type: 'Regional Transport Hub',
    fullAddress: 'Rajahmundry Freight Hub, NH 16, East Godavari, Andhra Pradesh, 533101, India',
  },
  Eluru: {
    lat: 16.7107,
    lon: 81.0952,
    label: 'Eluru Freight Center',
    city: 'Eluru',
    state: 'Andhra Pradesh',
    country: 'India',
    postcode: '534001',
    road: 'NH 16 Highway Corridor',
    type: 'Regional Logistics Center',
    fullAddress: 'Eluru Freight Center, NH 16, West Godavari, Andhra Pradesh, 534001, India',
  },
  VR_Siddhartha: {
    lat: 16.4856,
    lon: 80.6924,
    label: 'VR Siddhartha Engineering College',
    city: 'Vijayawada',
    state: 'Andhra Pradesh',
    country: 'India',
    postcode: '520007',
    road: 'Kanuru Road',
    type: 'Academic & Tech Landmark',
    fullAddress: 'Velagapudi Ramakrishna Siddhartha Engineering College, Kanuru, Vijayawada, Andhra Pradesh, 520007, India',
  },

  // Global Hubs
  Shanghai: {
    lat: 31.2304,
    lon: 121.4737,
    label: 'Port of Shanghai (Yangshan)',
    city: 'Shanghai',
    state: 'Shanghai',
    country: 'China',
    postcode: '200000',
    road: 'Donghai Bridge Highway',
    type: 'Container Port',
    fullAddress: 'Port of Shanghai, Yangshan Deepwater Port, Pudong, Shanghai, 200000, China',
  },
  Ningbo: {
    lat: 29.8683,
    lon: 121.5440,
    label: 'Ningbo-Zhoushan Port',
    city: 'Ningbo',
    state: 'Zhejiang',
    country: 'China',
    postcode: '315000',
    road: 'Beilun Port Expressway',
    type: 'Container Port',
    fullAddress: 'Ningbo-Zhoushan Port Terminal, Beilun District, Ningbo, Zhejiang, 315000, China',
  },
  Shenzhen: {
    lat: 22.5431,
    lon: 114.0579,
    label: 'Port of Shenzhen (Yantian)',
    city: 'Shenzhen',
    state: 'Guangdong',
    country: 'China',
    postcode: '518000',
    road: 'Yantian Express Road',
    type: 'Deepwater Port',
    fullAddress: 'Yantian International Container Terminal, Yantian, Shenzhen, Guangdong, 518000, China',
  },
  Busan: {
    lat: 35.1796,
    lon: 129.0756,
    label: 'Port of Busan',
    city: 'Busan',
    state: 'Gyeongsangnam-do',
    country: 'South Korea',
    postcode: '48998',
    road: 'Busan New Port Expressway',
    type: 'Transshipment Hub',
    fullAddress: 'Busan New Port Container Terminal, Gangseo-gu, Busan, 48998, South Korea',
  },
  Tokyo: {
    lat: 35.6762,
    lon: 139.6503,
    label: 'Tokyo Cargo Hub',
    city: 'Tokyo',
    state: 'Kanto',
    country: 'Japan',
    postcode: '100-0001',
    road: 'Shuto Expressway Bay Route',
    type: 'Air & Port Gateway',
    fullAddress: 'Tokyo Bay Port Terminal, Koto City, Tokyo, 100-0001, Japan',
  },
  Hong_Kong: {
    lat: 22.3193,
    lon: 114.1694,
    label: 'Hong Kong International Cargo Gateway',
    city: 'Hong Kong',
    state: 'New Territories',
    country: 'Hong Kong',
    postcode: '999077',
    road: 'Airport Expressway',
    type: 'Air Cargo Gateway',
    fullAddress: 'Hong Kong International Cargo Terminal, Chek Lap Kok, Hong Kong, 999077',
  },
  Singapore: {
    lat: 1.3521,
    lon: 103.8198,
    label: 'Port of Singapore (PSA Hub)',
    city: 'Singapore',
    state: 'Central Region',
    country: 'Singapore',
    postcode: '098656',
    road: 'West Coast Highway / Pasir Panjang',
    type: 'Global Transshipment Hub',
    fullAddress: 'PSA Singapore Terminals, Pasir Panjang Road, Singapore, 098656',
  },
  Ho_Chi_Minh_City: {
    lat: 10.8231,
    lon: 106.6297,
    label: 'Cat Lai Port (HCMC)',
    city: 'Ho Chi Minh City',
    state: 'Southeast Region',
    country: 'Vietnam',
    postcode: '700000',
    road: 'Nguyen Thi Dinh Street',
    type: 'Container Terminal',
    fullAddress: 'Cat Lai Terminal, Thu Duc City, Ho Chi Minh City, 700000, Vietnam',
  },
  Dubai: {
    lat: 25.2048,
    lon: 55.2708,
    label: 'Jebel Ali Port & Hub',
    city: 'Dubai',
    state: 'Dubai',
    country: 'United Arab Emirates',
    postcode: '00000',
    road: 'Sheikh Zayed Road / E11',
    type: 'Deepwater Port & Hub',
    fullAddress: 'DP World Jebel Ali Free Zone, Sheikh Zayed Road, Dubai, United Arab Emirates',
  },
  Rotterdam: {
    lat: 51.9244,
    lon: 4.4777,
    label: 'Port of Rotterdam (Maasvlakte)',
    city: 'Rotterdam',
    state: 'South Holland',
    country: 'Netherlands',
    postcode: '3011 AA',
    road: 'A15 Havens Freight Highway',
    type: 'European Gateway Port',
    fullAddress: 'Port of Rotterdam, Havenmeesterlaan 1, 3011 AA Rotterdam, Netherlands',
  },
  Frankfurt: {
    lat: 50.1109,
    lon: 8.6821,
    label: 'Frankfurt CargoCity Intermodal',
    city: 'Frankfurt am Main',
    state: 'Hesse',
    country: 'Germany',
    postcode: '60311',
    road: 'Autobahn A3 / A5 Frankfurter Kreuz',
    type: 'Air & Rail Cargo Hub',
    fullAddress: 'CargoCity South, Frankfurt Airport, 60311 Frankfurt am Main, Germany',
  },
  Hamburg: {
    lat: 53.5511,
    lon: 9.9937,
    label: 'Port of Hamburg',
    city: 'Hamburg',
    state: 'Hamburg',
    country: 'Germany',
    postcode: '20095',
    road: 'A7 / Köhlbrandbrücke',
    type: 'Seaport & Rail Hub',
    fullAddress: 'Hamburger Hafen Container Terminal, 20095 Hamburg, Germany',
  },
  Antwerp: {
    lat: 51.2194,
    lon: 4.4025,
    label: 'Port of Antwerp-Bruges',
    city: 'Antwerp',
    state: 'Flanders',
    country: 'Belgium',
    postcode: '2000',
    road: 'R2 Port Ring / Scheldt Corridor',
    type: 'Chemical & Container Port',
    fullAddress: 'Port House, Zaha Hadidplein 1, 2000 Antwerp, Belgium',
  },
  Long_Beach: {
    lat: 33.7701,
    lon: -118.1937,
    label: 'Port of Long Beach',
    city: 'Long Beach',
    state: 'California',
    country: 'United States',
    postcode: '90802',
    road: 'I-710 Long Beach Freeway',
    type: 'Pacific Gateway Port',
    fullAddress: 'Port of Long Beach, 415 W Ocean Blvd, Long Beach, CA 90802, United States',
  },
  Los_Angeles: {
    lat: 34.0522,
    lon: -118.2437,
    label: 'Port of Los Angeles Hub',
    city: 'Los Angeles',
    state: 'California',
    country: 'United States',
    postcode: '90731',
    road: 'I-110 Harbor Freeway / Alameda Corridor',
    type: 'Intermodal Logistics Center',
    fullAddress: 'Port of Los Angeles, 425 S Palos Verdes St, San Pedro, CA 90731, United States',
  },
  Oakland: {
    lat: 37.8044,
    lon: -122.2712,
    label: 'Port of Oakland',
    city: 'Oakland',
    state: 'California',
    country: 'United States',
    postcode: '94607',
    road: 'I-880 Maritime Freeway',
    type: 'Pacific Coast Port',
    fullAddress: 'Port of Oakland, 530 Water St, Oakland, CA 94607, United States',
  },
  Seattle: {
    lat: 47.6062,
    lon: -122.3321,
    label: 'Port of Seattle / Northwest Seaport',
    city: 'Seattle',
    state: 'Washington',
    country: 'United States',
    postcode: '98101',
    road: 'I-5 / SR-99 Alaska Way',
    type: 'Northwest Pacific Port',
    fullAddress: 'Northwest Seaport Alliance, 2711 Alaskan Way, Seattle, WA 98101, United States',
  },
  Chicago: {
    lat: 41.8781,
    lon: -87.6298,
    label: 'Chicago BNSF Rail Hub',
    city: 'Chicago',
    state: 'Illinois',
    country: 'United States',
    postcode: '60607',
    road: 'I-55 Stevenson Expressway / I-90',
    type: 'Inland Rail Terminal',
    fullAddress: 'BNSF Corwith Intermodal Facility, 4100 S Kedzie Ave, Chicago, IL 60632, United States',
  },
  Dallas: {
    lat: 32.7767,
    lon: -96.7970,
    label: 'Dallas-Fort Worth Logistics Hub',
    city: 'Dallas',
    state: 'Texas',
    country: 'United States',
    postcode: '75201',
    road: 'I-35E / I-20 Freight Corridor',
    type: 'Inland Distribution Center',
    fullAddress: 'DFW Logistics Center, 2700 Aviation Dr, DFW Airport, TX 75261, United States',
  },
  Atlanta: {
    lat: 33.7490,
    lon: -84.3880,
    label: 'Atlanta Freight Gateway',
    city: 'Atlanta',
    state: 'Georgia',
    country: 'United States',
    postcode: '30303',
    road: 'I-285 Perimeter / I-75 Highway',
    type: 'Southeast Freight Gateway',
    fullAddress: 'Atlanta Intermodal Freight Terminal, 1200 Marietta Blvd NW, Atlanta, GA 30318, United States',
  },
  Phoenix: {
    lat: 33.4484,
    lon: -112.0740,
    label: 'Phoenix Inland Freight Hub',
    city: 'Phoenix',
    state: 'Arizona',
    country: 'United States',
    postcode: '85001',
    road: 'I-10 Papago Freeway Corridor',
    type: 'Regional Freight Hub',
    fullAddress: 'Phoenix West Freight Terminal, 51st Ave & Buckeye Rd, Phoenix, AZ 85043, United States',
  },
  Oklahoma_City: {
    lat: 35.4676,
    lon: -97.5164,
    label: 'Oklahoma City Corridor Hub',
    city: 'Oklahoma City',
    state: 'Oklahoma',
    country: 'United States',
    postcode: '73102',
    road: 'I-35 / I-40 Crossroads Corridor',
    type: 'Crossroads Logistics Hub',
    fullAddress: 'Oklahoma City Freight Hub, I-35 & I-40 Interchange, Oklahoma City, OK 73129, United States',
  },
  Toronto: {
    lat: 43.6532,
    lon: -79.3832,
    label: 'Toronto Intermodal Hub',
    city: 'Toronto',
    state: 'Ontario',
    country: 'Canada',
    postcode: 'M5H 2N2',
    road: 'Highway 401 Logistics Corridor',
    type: 'Intermodal Freight Terminal',
    fullAddress: 'CN Brampton Intermodal Terminal, 2 Intermodal Dr, Brampton, ON L6T 5K9, Canada',
  },
  Monterrey: {
    lat: 25.6866,
    lon: -100.3161,
    label: 'Monterrey Industrial Gateway',
    city: 'Monterrey',
    state: 'Nuevo León',
    country: 'Mexico',
    postcode: '64000',
    road: 'Carretera Federal 85 / Laredo Route',
    type: 'Industrial Freight Corridor',
    fullAddress: 'Monterrey Industrial Intermodal Gateway, Apodaca, Nuevo León, 66600, Mexico',
  },
  Mexico_City: {
    lat: 19.4326,
    lon: -99.1332,
    label: 'Mexico City Logistics Hub',
    city: 'Mexico City',
    state: 'CDMX',
    country: 'Mexico',
    postcode: '06000',
    road: 'Autopista Mexico-Queretaro 57D',
    type: 'Central Logistics Center',
    fullAddress: 'Terminal Intermodal Pantaco, Ferrería, Azcapotzalco, 02310 Ciudad de México, Mexico',
  },
  Panama_Canal: {
    lat: 9.0800,
    lon: -79.6800,
    label: 'Panama Canal Transit Waypoint',
    city: 'Panama City',
    state: 'Panamá',
    country: 'Panama',
    postcode: '0801',
    road: 'Corredor Norte / Canal Access',
    type: 'Interoceanic Canal Waypoint',
    fullAddress: 'Panama Canal Authority (ACP), Balboa, Panama City, Panama',
  },
  Sydney: {
    lat: -33.8688,
    lon: 151.2093,
    label: 'Port Botany Sydney',
    city: 'Sydney',
    state: 'New South Wales',
    country: 'Australia',
    postcode: '2000',
    road: 'M5 East Motorway / Foreshore Rd',
    type: 'Container Port Hub',
    fullAddress: 'Port Botany Container Terminal, Botany Rd, Port Botany NSW 2036, Australia',
  },
  Pacific_Ocean: {
    lat: 28.0000,
    lon: -155.0000,
    label: 'Pacific Ocean Maritime Corridor',
    city: 'Mid-Pacific',
    state: 'International Waters',
    country: 'International',
    type: 'Maritime Transit Corridor',
    fullAddress: 'Trans-Pacific Maritime Navigation Corridor, North Pacific Ocean',
  },
  North_Sea: {
    lat: 56.0000,
    lon: 4.0000,
    label: 'North Sea Maritime Lane',
    city: 'North Sea',
    state: 'International Waters',
    country: 'Europe',
    type: 'Maritime Transit Corridor',
    fullAddress: 'North Sea Maritime Shipping Route, North-Western Europe',
  },
  Arabian_Sea: {
    lat: 18.0000,
    lon: 65.0000,
    label: 'Arabian Sea Maritime Corridor',
    city: 'Arabian Sea',
    state: 'International Waters',
    country: 'Indian Ocean',
    type: 'Maritime Transit Corridor',
    fullAddress: 'Arabian Sea Commercial Shipping Lane, Western Indian Ocean',
  },
  Coral_Sea: {
    lat: -18.0000,
    lon: 155.0000,
    label: 'Coral Sea Maritime Corridor',
    city: 'Coral Sea',
    state: 'International Waters',
    country: 'South Pacific',
    type: 'Maritime Transit Corridor',
    fullAddress: 'Coral Sea Shipping Route, South Pacific Ocean',
  },
  East_China_Sea: {
    lat: 28.5000,
    lon: 125.0000,
    label: 'East China Sea Corridor',
    city: 'East China Sea',
    state: 'International Waters',
    country: 'East Asia',
    type: 'Maritime Transit Corridor',
    fullAddress: 'East China Sea Maritime Shipping Corridor, East Asia',
  },
  South_China_Sea: {
    lat: 12.0000,
    lon: 113.0000,
    label: 'South China Sea Corridor',
    city: 'South China Sea',
    state: 'International Waters',
    country: 'Southeast Asia',
    type: 'Maritime Transit Corridor',
    fullAddress: 'South China Sea International Shipping Lane',
  },
  Malacca_Strait: {
    lat: 2.5000,
    lon: 101.5000,
    label: 'Strait of Malacca Transit',
    city: 'Strait of Malacca',
    state: 'International Waters',
    country: 'Southeast Asia',
    type: 'Maritime Bottleneck & Waypoint',
    fullAddress: 'Strait of Malacca Maritime Passage, Southeast Asia',
  },
  Suez_Canal: {
    lat: 30.5852,
    lon: 32.5653,
    label: 'Suez Canal Gateway',
    city: 'Suez',
    state: 'Suez Governorate',
    country: 'Egypt',
    type: 'Interoceanic Canal Waypoint',
    fullAddress: 'Suez Canal Authority Navigation Channel, Suez, Egypt',
  },
  Frankfurt_Airport: {
    lat: 50.0379,
    lon: 8.5622,
    label: 'Frankfurt CargoCity (Airport)',
    city: 'Frankfurt',
    state: 'Hesse',
    country: 'Germany',
    type: 'Air Cargo Intermodal Hub',
    fullAddress: 'Frankfurt Airport CargoCity South, 60549 Frankfurt am Main, Germany',
  },
  Machilipatnam: {
    lat: 16.1808,
    lon: 81.1303,
    label: 'Machilipatnam Port & Logistics',
    city: 'Machilipatnam',
    state: 'Andhra Pradesh',
    country: 'India',
    postcode: '521001',
    road: 'NH 216 / Port Highway',
    type: 'Deepwater Port & Hub',
    fullAddress: 'Machilipatnam Port Logistics Zone, Krishna District, Andhra Pradesh, 521001, India',
  },
}

export const LOCATION_ALIASES = {
  'pacific ocean': 'Pacific_Ocean',
  pacific_ocean: 'Pacific_Ocean',
  'pacific': 'Pacific_Ocean',
  'north sea': 'North_Sea',
  north_sea: 'North_Sea',
  'arabian sea': 'Arabian_Sea',
  arabian_sea: 'Arabian_Sea',
  'coral sea': 'Coral_Sea',
  coral_sea: 'Coral_Sea',
  'east china sea': 'East_China_Sea',
  east_china_sea: 'East_China_Sea',
  'south china sea': 'South_China_Sea',
  south_china_sea: 'South_China_Sea',
  'strait of malacca': 'Malacca_Strait',
  malacca_strait: 'Malacca_Strait',
  'malacca strait': 'Malacca_Strait',
  'suez canal': 'Suez_Canal',
  suez_canal: 'Suez_Canal',
  'frankfurt airport': 'Frankfurt_Airport',
  frankfurt_airport: 'Frankfurt_Airport',
  machilipatnam: 'Machilipatnam',
  'machilipatnam, india': 'Machilipatnam',
  'machilipatnam, ap': 'Machilipatnam',
  hjunction: 'H_Junction',
  h_junction: 'H_Junction',
  'h-junction': 'H_Junction',
  'h junction': 'H_Junction',
  'h.junction': 'H_Junction',
  hanuman_junction: 'H_Junction',
  hanumanjunction: 'H_Junction',
  'hanuman junction': 'H_Junction',
  'hanuman junction, andhra pradesh': 'H_Junction',
  'hanuman junction, india': 'H_Junction',
  vijayawada: 'Vijayawada',
  'vijayawada, india': 'Vijayawada',
  'vijayawada, in': 'Vijayawada',
  'vijayawada, ap': 'Vijayawada',
  'vijayawada, andhra pradesh': 'Vijayawada',
  vja: 'Vijayawada',
  bezawada: 'Vijayawada',
  'vr siddhartha': 'VR_Siddhartha',
  'vr siddhartha engineering college': 'VR_Siddhartha',
  vrsec: 'VR_Siddhartha',
  'kanuru, vijayawada': 'VR_Siddhartha',
  hyderabad: 'Hyderabad',
  'hyderabad, india': 'Hyderabad',
  'hyderabad, telangana': 'Hyderabad',
  hyd: 'Hyderabad',
  secunderabad: 'Hyderabad',
  visakhapatnam: 'Visakhapatnam',
  'visakhapatnam, india': 'Visakhapatnam',
  'visakhapatnam, ap': 'Visakhapatnam',
  vizag: 'Visakhapatnam',
  vtz: 'Visakhapatnam',
  chennai: 'Chennai',
  'chennai, india': 'Chennai',
  'chennai, tamil nadu': 'Chennai',
  madras: 'Chennai',
  maa: 'Chennai',
  bengaluru: 'Bengaluru',
  'bengaluru, india': 'Bengaluru',
  'bengaluru, karnataka': 'Bengaluru',
  bangalore: 'Bengaluru',
  blr: 'Bengaluru',
  delhi: 'Delhi',
  'delhi, india': 'Delhi',
  'delhi ncr': 'Delhi',
  new_delhi: 'Delhi',
  'new delhi': 'Delhi',
  del: 'Delhi',
  kolkata: 'Kolkata',
  'kolkata, india': 'Kolkata',
  calcutta: 'Kolkata',
  ccu: 'Kolkata',
  cochin: 'Cochin',
  'cochin, india': 'Cochin',
  kochi: 'Cochin',
  cok: 'Cochin',
  ahmedabad: 'Ahmedabad',
  'ahmedabad, india': 'Ahmedabad',
  'ahmedabad, gujarat': 'Ahmedabad',
  amd: 'Ahmedabad',
  mumbai: 'Mumbai',
  'mumbai, in': 'Mumbai',
  'mumbai, india': 'Mumbai',
  'mumbai, maharashtra': 'Mumbai',
  bombay: 'Mumbai',
  bom: 'Mumbai',
  jnpt: 'Mumbai',
  'nhava sheva': 'Mumbai',
  pune: 'Pune',
  'pune, india': 'Pune',
  pnq: 'Pune',
  mundra: 'Mundra',
  'mundra, india': 'Mundra',
  'mundra, gujarat': 'Mundra',
  nagpur: 'Nagpur',
  'nagpur, india': 'Nagpur',
  guntur: 'Guntur',
  'guntur, india': 'Guntur',
  'guntur, ap': 'Guntur',
  'guntur, andhra pradesh': 'Guntur',
  rajahmundry: 'Rajahmundry',
  'rajahmundry, india': 'Rajahmundry',
  eluru: 'Eluru',
  'eluru, india': 'Eluru',

  shanghai: 'Shanghai',
  'shanghai, cn': 'Shanghai',
  'shanghai, china': 'Shanghai',
  sha: 'Shanghai',
  pvg: 'Shanghai',
  shenzhen: 'Shenzhen',
  'shenzhen, cn': 'Shenzhen',
  'shenzhen, china': 'Shenzhen',
  szx: 'Shenzhen',
  yantian: 'Shenzhen',
  ningbo: 'Ningbo',
  'ningbo, cn': 'Ningbo',
  nbo: 'Ningbo',
  busan: 'Busan',
  'busan, kr': 'Busan',
  'busan, south korea': 'Busan',
  pus: 'Busan',
  tokyo: 'Tokyo',
  'tokyo, jp': 'Tokyo',
  'tokyo, japan': 'Tokyo',
  tyo: 'Tokyo',
  hnd: 'Tokyo',
  nrt: 'Tokyo',
  hong_kong: 'Hong_Kong',
  'hong kong': 'Hong_Kong',
  'hong kong, hk': 'Hong_Kong',
  hongkong: 'Hong_Kong',
  hk: 'Hong_Kong',
  hkg: 'Hong_Kong',

  singapore: 'Singapore',
  'singapore, sg': 'Singapore',
  sin: 'Singapore',
  ho_chi_minh: 'Ho_Chi_Minh_City',
  'ho chi minh': 'Ho_Chi_Minh_City',
  ho_chi_minh_city: 'Ho_Chi_Minh_City',
  'ho chi minh city': 'Ho_Chi_Minh_City',
  'ho chi minh city, vn': 'Ho_Chi_Minh_City',
  'ho chi minh city, vietnam': 'Ho_Chi_Minh_City',
  hcm: 'Ho_Chi_Minh_City',
  saigon: 'Ho_Chi_Minh_City',
  cat_lai: 'Ho_Chi_Minh_City',
  sydney: 'Sydney',
  'sydney, au': 'Sydney',
  'sydney, australia': 'Sydney',
  syd: 'Sydney',

  dubai: 'Dubai',
  'dubai, ae': 'Dubai',
  'dubai, uae': 'Dubai',
  'dubai, united arab emirates': 'Dubai',
  dxb: 'Dubai',
  jebel_ali: 'Dubai',
  'jebel ali': 'Dubai',

  rotterdam: 'Rotterdam',
  'rotterdam, nl': 'Rotterdam',
  'rotterdam, netherlands': 'Rotterdam',
  rtm: 'Rotterdam',
  frankfurt: 'Frankfurt',
  'frankfurt, de': 'Frankfurt',
  'frankfurt, germany': 'Frankfurt',
  fra: 'Frankfurt',
  hamburg: 'Hamburg',
  'hamburg, de': 'Hamburg',
  'hamburg, germany': 'Hamburg',
  ham: 'Hamburg',
  antwerp: 'Antwerp',
  'antwerp, be': 'Antwerp',
  'antwerp, belgium': 'Antwerp',
  anr: 'Antwerp',

  long_beach: 'Long_Beach',
  'long beach': 'Long_Beach',
  'long beach, us': 'Long_Beach',
  'long beach, united states': 'Long_Beach',
  'long beach, ca': 'Long_Beach',
  'long beach, california': 'Long_Beach',
  lgb: 'Long_Beach',
  los_angeles: 'Los_Angeles',
  'los angeles': 'Los_Angeles',
  'los angeles, us': 'Los_Angeles',
  'los angeles, ca': 'Los_Angeles',
  la: 'Los_Angeles',
  'l.a.': 'Los_Angeles',
  lax: 'Los_Angeles',
  oakland: 'Oakland',
  'oakland, us': 'Oakland',
  'oakland, ca': 'Oakland',
  oak: 'Oakland',
  seattle: 'Seattle',
  'seattle, us': 'Seattle',
  'seattle, wa': 'Seattle',
  sea: 'Seattle',
  chicago: 'Chicago',
  'chicago, us': 'Chicago',
  'chicago, il': 'Chicago',
  ord: 'Chicago',
  dallas: 'Dallas',
  'dallas, us': 'Dallas',
  'dallas, tx': 'Dallas',
  dfw: 'Dallas',
  atlanta: 'Atlanta',
  'atlanta, us': 'Atlanta',
  'atlanta, ga': 'Atlanta',
  atl: 'Atlanta',
  phoenix: 'Phoenix',
  'phoenix, us': 'Phoenix',
  'phoenix, az': 'Phoenix',
  phx: 'Phoenix',
  oklahoma_city: 'Oklahoma_City',
  'oklahoma city': 'Oklahoma_City',
  'oklahoma city, us': 'Oklahoma_City',
  'oklahoma city, ok': 'Oklahoma_City',
  okc: 'Oklahoma_City',
  toronto: 'Toronto',
  'toronto, ca': 'Toronto',
  'toronto, canada': 'Toronto',
  'toronto, on': 'Toronto',
  yyz: 'Toronto',
  monterrey: 'Monterrey',
  'monterrey, mx': 'Monterrey',
  'monterrey, mexico': 'Monterrey',
  mty: 'Monterrey',
  mexico_city: 'Mexico_City',
  'mexico city': 'Mexico_City',
  'mexico city, mx': 'Mexico_City',
  'mexico city, mexico': 'Mexico_City',
  mex: 'Mexico_City',
  panama_canal: 'Panama_Canal',
  'panama canal': 'Panama_Canal',
  pty: 'Panama_Canal',
}

// Throttled request queue to strictly honor Nominatim's 1-request-per-second policy
let lastNominatimRequestTime = 0
const NOMINATIM_MIN_INTERVAL_MS = 1000

async function throttledNominatimFetch(url, signal) {
  const now = Date.now()
  const timeSinceLast = now - lastNominatimRequestTime
  if (timeSinceLast < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS - timeSinceLast))
  }
  lastNominatimRequestTime = Date.now()

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'SupplyChainAIControlTower/1.0 (Logistics-Demo-Platform)',
    },
    signal,
  })
  if (!response.ok) {
    throw new Error(`Nominatim HTTP error ${response.status}`)
  }
  return response.json()
}

/**
 * Format raw Nominatim address object into clean, human-readable components
 */
export function formatStructuredAddress(rawAddress, displayName = '') {
  if (!rawAddress) {
    return {
      street: displayName.split(',')[0] || '',
      city: '',
      state: '',
      country: '',
      postcode: '',
      fullAddress: displayName || 'Resolved Location',
    }
  }

  const street =
    rawAddress.road ||
    rawAddress.pedestrian ||
    rawAddress.suburb ||
    rawAddress.neighbourhood ||
    rawAddress.industrial ||
    rawAddress.amenity ||
    rawAddress.building ||
    ''

  const city =
    rawAddress.city ||
    rawAddress.town ||
    rawAddress.village ||
    rawAddress.municipality ||
    rawAddress.county ||
    rawAddress.district ||
    ''

  const state = rawAddress.state || rawAddress.province || rawAddress.region || ''
  const country = rawAddress.country || ''
  const postcode = rawAddress.postcode || ''

  const parts = [street, city, state, postcode, country].filter(Boolean)
  const fullAddress = displayName || parts.join(', ') || 'Resolved Location'

  return {
    street,
    city,
    state,
    country,
    postcode,
    fullAddress,
  }
}

/**
 * Normalizes user query or hub name
 */
export function normalizeLocationQuery(query) {
  if (!query || typeof query !== 'string') return ''
  return query.trim()
}

/**
 * Resolves query against predefined hubs synchronously using comprehensive alias rules
 */
export function resolvePredefinedHub(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return null
  const clean = rawQuery.trim()
  const lowerClean = clean.toLowerCase()
  const lowerFirst = clean.split(',')[0].trim().toLowerCase()
  const lowerKey = lowerClean.replace(/[\s_.,-]+/g, '')
  const lowerFirstKey = lowerFirst.replace(/[\s_.,-]+/g, '')

  // 1. Direct alias match on full string or first token
  if (LOCATION_ALIASES[lowerClean] && PREDEFINED_HUBS[LOCATION_ALIASES[lowerClean]]) {
    return PREDEFINED_HUBS[LOCATION_ALIASES[lowerClean]]
  }
  if (LOCATION_ALIASES[lowerFirst] && PREDEFINED_HUBS[LOCATION_ALIASES[lowerFirst]]) {
    return PREDEFINED_HUBS[LOCATION_ALIASES[lowerFirst]]
  }
  if (LOCATION_ALIASES[lowerKey] && PREDEFINED_HUBS[LOCATION_ALIASES[lowerKey]]) {
    return PREDEFINED_HUBS[LOCATION_ALIASES[lowerKey]]
  }
  if (LOCATION_ALIASES[lowerFirstKey] && PREDEFINED_HUBS[LOCATION_ALIASES[lowerFirstKey]]) {
    return PREDEFINED_HUBS[LOCATION_ALIASES[lowerFirstKey]]
  }

  // 2. Direct key match in PREDEFINED_HUBS
  const underscored = clean.replace(/\s+/g, '_')
  if (PREDEFINED_HUBS[underscored]) return PREDEFINED_HUBS[underscored]
  if (PREDEFINED_HUBS[clean]) return PREDEFINED_HUBS[clean]

  // 3. Normalized stripped key match in PREDEFINED_HUBS
  for (const [k, v] of Object.entries(PREDEFINED_HUBS)) {
    const kLower = k.toLowerCase()
    const kStripped = kLower.replace(/[\s_.,-]+/g, '')
    if (kLower === lowerClean || kLower === lowerFirst || kStripped === lowerKey || kStripped === lowerFirstKey) {
      return v
    }
  }

  // 4. Substring / city / label matching
  for (const [k, v] of Object.entries(PREDEFINED_HUBS)) {
    const kLower = k.toLowerCase()
    const cityLower = (v.city || '').toLowerCase()
    const labelLower = (v.label || '').toLowerCase()
    if (
      lowerClean.includes(kLower) ||
      (cityLower && lowerClean.includes(cityLower)) ||
      (labelLower && lowerClean.includes(labelLower))
    ) {
      return v
    }
  }

  return null
}

/**
 * Geocode any arbitrary address using Predefined Hubs first, then cached results, then OSM Nominatim
 */
export async function geocodeAddress(query, signal) {
  const cleanQuery = normalizeLocationQuery(query)
  if (!cleanQuery) return null

  const cacheKey = cleanQuery.toLowerCase()
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)
  }

  // Step 1: Predefined Hub check (deterministic & immediate)
  const predefined = resolvePredefinedHub(cleanQuery)
  if (predefined) {
    const res = {
      lat: predefined.lat,
      lon: predefined.lon,
      label: predefined.label,
      city: predefined.city,
      state: predefined.state,
      country: predefined.country,
      postcode: predefined.postcode,
      road: predefined.road,
      type: predefined.type,
      fullAddress: predefined.fullAddress,
      isPredefined: true,
      source: 'PREDEFINED_HUB',
    }
    geocodeCache.set(cacheKey, res)
    return res
  }

  // Step 2: Query OpenStreetMap Nominatim
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&addressdetails=1&limit=1`
  try {
    const data = await throttledNominatimFetch(url, signal)
    if (Array.isArray(data) && data.length > 0) {
      const top = data[0]
      const lat = parseFloat(top.lat)
      const lon = parseFloat(top.lon)
      const addrDetails = top.address || {}
      const structured = formatStructuredAddress(addrDetails, top.display_name)

      const result = {
        lat,
        lon,
        label: top.name || structured.street || structured.city || cleanQuery,
        city: structured.city,
        state: structured.state,
        country: structured.country,
        postcode: structured.postcode,
        road: structured.street,
        type: top.type ? top.type.replace(/_/g, ' ') : 'Resolved Address',
        fullAddress: structured.fullAddress,
        isPredefined: false,
        source: 'NOMINATIM_GEOCODING',
      }
      geocodeCache.set(cacheKey, result)
      return result
    }
  } catch (_err) {
    return null
  }

  return null
}

/**
 * Reverse-geocode latitude/longitude into a human-readable structured address
 */
export async function reverseGeocode(lat, lon, signal) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    return null
  }

  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`
  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey)
  }

  // Check if coordinates match any predefined hub
  for (const hub of Object.values(PREDEFINED_HUBS)) {
    if (Math.abs(hub.lat - lat) < 0.005 && Math.abs(hub.lon - lon) < 0.005) {
      reverseGeocodeCache.set(cacheKey, hub)
      return hub
    }
  }

  // Query OSM Nominatim Reverse Geocoding
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
  try {
    const data = await throttledNominatimFetch(url, signal)
    if (data && data.address) {
      const structured = formatStructuredAddress(data.address, data.display_name)
      const result = {
        lat,
        lon,
        label: data.name || structured.street || structured.city || 'Resolved GPS Location',
        city: structured.city,
        state: structured.state,
        country: structured.country,
        postcode: structured.postcode,
        road: structured.street,
        type: data.type ? data.type.replace(/_/g, ' ') : 'Geocoded GPS Point',
        fullAddress: structured.fullAddress,
        isPredefined: false,
        source: 'NOMINATIM_REVERSE',
      }
      reverseGeocodeCache.set(cacheKey, result)
      return result
    }
  } catch (_err) {
    return null
  }

  return null
}

/**
 * Search autocomplete address suggestions for user input (returns up to 5 suggestions)
 */
export async function searchAddressSuggestions(query, signal) {
  const cleanQuery = normalizeLocationQuery(query)
  if (!cleanQuery || cleanQuery.length < 2) return []

  const results = []
  const lowerQuery = cleanQuery.toLowerCase()

  // 1. Check Predefined Hubs matches
  for (const [key, hub] of Object.entries(PREDEFINED_HUBS)) {
    const matches =
      key.toLowerCase().includes(lowerQuery) ||
      (hub.city && hub.city.toLowerCase().includes(lowerQuery)) ||
      (hub.label && hub.label.toLowerCase().includes(lowerQuery)) ||
      (hub.fullAddress && hub.fullAddress.toLowerCase().includes(lowerQuery))

    if (matches) {
      results.push({
        id: `hub-${key}`,
        label: hub.label,
        lat: hub.lat,
        lon: hub.lon,
        city: hub.city,
        state: hub.state,
        country: hub.country,
        fullAddress: hub.fullAddress,
        type: hub.type,
        isPredefined: true,
      })
    }
  }

  // 2. If fewer than 5 matches, query Nominatim
  if (results.length < 5) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&addressdetails=1&limit=${5 - results.length}`
    try {
      const data = await throttledNominatimFetch(url, signal)
      if (Array.isArray(data)) {
        for (const item of data) {
          const lat = parseFloat(item.lat)
          const lon = parseFloat(item.lon)
          if (results.some((r) => Math.abs(r.lat - lat) < 0.005 && Math.abs(r.lon - lon) < 0.005)) {
            continue
          }
          const structured = formatStructuredAddress(item.address || {}, item.display_name)
          results.push({
            id: `nom-${item.place_id || Math.random()}`,
            label: item.name || structured.street || structured.city || cleanQuery,
            lat,
            lon,
            city: structured.city,
            state: structured.state,
            country: structured.country,
            fullAddress: structured.fullAddress,
            type: item.type ? item.type.replace(/_/g, ' ') : 'Address',
            isPredefined: false,
          })
        }
      }
    } catch (_err) {
      // return whatever we have
    }
  }

  return results.slice(0, 5)
}
