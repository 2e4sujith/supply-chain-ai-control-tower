const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

async function request(path, options = {}) {
    let response
    try {
        response = await fetch(`${API_BASE_URL}${path}`, { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options })
    } catch {
        throw new Error('Backend server is unavailable.')
    }
    if (!response.ok) {
        if (response.status === 404) throw new Error('The requested resource was not found.')
        if (response.status === 422) throw new Error('Please check the submitted information.')
        if (response.status >= 500) throw new Error('Backend server is unavailable.')
        throw new Error('Unable to complete the request.')
    }
    return response.status === 204 ? null : response.json()
}

export function normalizeShipment(shipment) {
    return { id: shipment.shipment_id, origin: shipment.origin, destination: shipment.destination, currentLocation: shipment.current_location, status: shipment.status, riskScore: shipment.risk_score, risk: shipment.risk_level, eta: shipment.eta, lastUpdated: shipment.last_updated, priority: shipment.priority, riskFactors: shipment.risk_factors }
}

function shipmentPayload(data) {
    return { shipment_id: data.shipment_id || data.id, origin: data.origin, destination: data.destination, current_location: data.current_location || data.currentLocation, status: data.status, risk_score: data.risk_score || data.riskScore || 0, risk_level: data.risk_level || data.risk || 'Low', eta: data.eta || data.expectedDelivery, last_updated: data.last_updated || data.lastUpdated || 'Just now', priority: data.priority, risk_factors: data.risk_factors || data.riskFactors || ['New shipment awaiting monitoring'] }
}

export async function getShipments() { return (await request('/api/shipments')).map(normalizeShipment) }
export async function getShipment(id) { return normalizeShipment(await request(`/api/shipments/${id}`)) }
export async function createShipment(data) { return normalizeShipment(await request('/api/shipments', { method: 'POST', body: JSON.stringify(shipmentPayload(data)) })) }
export async function updateShipment(id, data) { return normalizeShipment(await request(`/api/shipments/${id}`, { method: 'PUT', body: JSON.stringify(data) })) }
export async function deleteShipment(id) { return request(`/api/shipments/${id}`, { method: 'DELETE' }) }

function normalizeAlert(alert) { return { id: alert.alert_id, shipment: alert.shipment_id, severity: alert.severity[0] + alert.severity.slice(1).toLowerCase(), type: alert.type, title: alert.title, message: alert.message, action: alert.recommended_action, time: new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), timestamp: alert.timestamp, read: alert.read } }
export async function getAlerts() { return (await request('/api/alerts')).map(normalizeAlert) }
export async function getAlert(id) { return normalizeAlert(await request(`/api/alerts/${id}`)) }
export async function markAlertAsRead(id) { return normalizeAlert(await request(`/api/alerts/${id}/read`, { method: 'PUT' })) }
export async function deleteAlert(id) { return request(`/api/alerts/${id}`, { method: 'DELETE' }) }

export async function getAnalyticsOverview() { return request('/api/analytics/overview') }
export async function getRiskDistribution() { return request('/api/analytics/risk-distribution') }
export async function getShipmentActivity() { return request('/api/analytics/activity') }
export async function getPerformance() { return request('/api/analytics/performance') }
export async function predictRisk(payload) {
    const body = typeof payload === 'string' ? { shipment_id: payload } : payload
    return request('/api/predictions/risk', { method: 'POST', body: JSON.stringify(body) })
}
export async function getPredictionHistory(shipmentId, limit = 20) {
    return request(`/api/predictions/history/${encodeURIComponent(shipmentId)}?limit=${limit}`)
}
export async function getAlternativeRoute(shipmentId, criterion = 'risk_adjusted') {
    return request('/api/routes/alternative', {
        method: 'POST',
        body: JSON.stringify({ shipment_id: shipmentId, criterion }),
    })
}

export async function optimizeRoute(origin, destination, criterion = 'time', avoidNodes = []) {
    return request('/api/routes/optimize', {
        method: 'POST',
        body: JSON.stringify({
            origin,
            destination,
            criterion,
            avoid_nodes: avoidNodes,
        }),
    })
}

export async function getRouteNetwork() {
    return request('/api/routes/network')
}
