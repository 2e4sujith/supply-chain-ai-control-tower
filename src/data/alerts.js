export const demoAlerts = [
    { id: 'ALT-204', time: '08:42', shipment: 'SHP-1048', severity: 'Critical', message: 'Shanghai terminal congestion may delay vessel departure by 48 hours.', action: 'Review alternate transload capacity', read: false },
    { id: 'ALT-203', time: '08:18', shipment: 'SHP-1082', severity: 'High', message: 'Severe weather warning detected along the North Sea route.', action: 'Confirm rerouting window', read: false },
    { id: 'ALT-202', time: '07:55', shipment: 'SHP-1107', severity: 'High', message: 'Driver hours constraint could impact final-mile arrival.', action: 'Contact regional carrier', read: false },
    { id: 'ALT-201', time: '07:31', shipment: 'SHP-1121', severity: 'Medium', message: 'Tropical storm track has shifted toward the current vessel lane.', action: 'Monitor vessel speed', read: true },
    { id: 'ALT-200', time: '06:48', shipment: 'SHP-1154', severity: 'Information', message: 'Customs documentation review has started at Frankfurt Airport.', action: 'No action required', read: true },
    { id: 'ALT-199', time: '06:22', shipment: 'SHP-1096', severity: 'Information', message: 'Shipment arrived at Dallas distribution hub.', action: 'Confirm receiving scan', read: true },
]

export const alertFilters = ['All', 'Critical', 'High', 'Medium', 'Information']