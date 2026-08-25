export const demoShipments = [
    { id: 'SHP-1048', origin: 'Shanghai, CN', destination: 'Long Beach, US', currentLocation: 'Pacific Ocean', status: 'Delayed', risk: 'Critical', riskScore: 91, eta: 'Aug 26, 08:30', lastUpdated: '12 min ago', priority: 'Urgent', riskFactors: ['Port congestion at origin', 'Vessel schedule slipped 48 hours', 'Weather system in transit lane'] },
    { id: 'SHP-1082', origin: 'Rotterdam, NL', destination: 'Hamburg, DE', currentLocation: 'North Sea', status: 'Rerouting', risk: 'High', riskScore: 78, eta: 'Aug 25, 14:10', lastUpdated: '34 min ago', priority: 'High', riskFactors: ['Severe weather warning', 'Alternate berth assigned'] },
    { id: 'SHP-1107', origin: 'Chicago, US', destination: 'Dallas, US', currentLocation: 'Oklahoma City, US', status: 'In transit', risk: 'High', riskScore: 72, eta: 'Aug 25, 19:45', lastUpdated: '48 min ago', priority: 'High', riskFactors: ['Driver hours constraint', 'Traffic delay on I-35'] },
    { id: 'SHP-1121', origin: 'Singapore, SG', destination: 'Sydney, AU', currentLocation: 'Coral Sea', status: 'Weather watch', risk: 'High', riskScore: 69, eta: 'Aug 27, 06:00', lastUpdated: '1 hr ago', priority: 'High', riskFactors: ['Tropical storm track', 'Reduced vessel speed'] },
    { id: 'SHP-1139', origin: 'Busan, KR', destination: 'Oakland, US', currentLocation: 'East China Sea', status: 'In transit', risk: 'Medium', riskScore: 54, eta: 'Aug 29, 11:20', lastUpdated: '1 hr ago', priority: 'Standard', riskFactors: ['Moderate port dwell time'] },
    { id: 'SHP-1154', origin: 'Frankfurt, DE', destination: 'Toronto, CA', currentLocation: 'Frankfurt Airport', status: 'Processing', risk: 'Medium', riskScore: 47, eta: 'Aug 26, 15:00', lastUpdated: '2 hrs ago', priority: 'Standard', riskFactors: ['Customs documentation review'] },
    { id: 'SHP-1172', origin: 'Mexico City, MX', destination: 'Atlanta, US', currentLocation: 'Monterrey, MX', status: 'In transit', risk: 'Low', riskScore: 21, eta: 'Aug 26, 09:15', lastUpdated: '2 hrs ago', priority: 'Standard', riskFactors: ['No active disruptions'] },
    { id: 'SHP-1188', origin: 'Mumbai, IN', destination: 'Dubai, AE', currentLocation: 'Arabian Sea', status: 'In transit', risk: 'Low', riskScore: 18, eta: 'Aug 28, 03:40', lastUpdated: '3 hrs ago', priority: 'Standard', riskFactors: ['No active disruptions'] },
    { id: 'SHP-1204', origin: 'Los Angeles, US', destination: 'Chicago, US', currentLocation: 'Phoenix, US', status: 'In transit', risk: 'Low', riskScore: 16, eta: 'Aug 25, 22:00', lastUpdated: '3 hrs ago', priority: 'Standard', riskFactors: ['No active disruptions'] },
    { id: 'SHP-1217', origin: 'Ho Chi Minh City, VN', destination: 'Seattle, US', currentLocation: 'South China Sea', status: 'Booked', risk: 'Medium', riskScore: 42, eta: 'Sep 01, 10:30', lastUpdated: '4 hrs ago', priority: 'Standard', riskFactors: ['Transshipment connection tight'] },
]

export const shipmentStatuses = ['All statuses', 'Booked', 'Processing', 'In transit', 'Delayed', 'Rerouting', 'Weather watch']
export const shipmentRisks = ['All risks', 'Low', 'Medium', 'High', 'Critical']

let shipmentStore = [...demoShipments]

export const getDemoShipments = () => shipmentStore
export const addDemoShipment = (shipment) => {
    shipmentStore = [shipment, ...shipmentStore]
    return shipment
}