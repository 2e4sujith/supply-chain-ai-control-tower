export function getApiBaseUrl() {
    if (import.meta.env.VITE_API_BASE_URL) {
        return import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
    }
    if (typeof window !== 'undefined' && window.location) {
        const host = window.location.hostname || 'localhost'
        return `http://${host}:8000`
    }
    return 'http://127.0.0.1:8000'
}

export function getWsUrl() {
    if (import.meta.env.VITE_WS_URL) {
        return import.meta.env.VITE_WS_URL
    }
    const base = getApiBaseUrl().replace(/^http/, 'ws')
    return `${base}/ws`
}

async function request(path, options = {}) {
    const baseUrl = getApiBaseUrl()
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`
    let response

    try {
        response = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
        })
    } catch (err) {
        // Fallback 1: Alternate loopback address (127.0.0.1 <-> localhost)
        try {
            const alternateHost = baseUrl.includes('localhost') ? 'http://127.0.0.1:8000' : 'http://localhost:8000'
            response = await fetch(`${alternateHost}${path}`, {
                headers: { 'Content-Type': 'application/json', ...options.headers },
                ...options,
            })
        } catch {
            // Fallback 2: Relative path (Vite Dev Server proxy)
            try {
                response = await fetch(path, {
                    headers: { 'Content-Type': 'application/json', ...options.headers },
                    ...options,
                })
            } catch (finalErr) {
                console.error(`Network request failed for ${url}:`, finalErr)
                throw new Error('Backend server is unavailable.')
            }
        }
    }

    if (!response.ok) {
        let errDetail = ''
        try {
            const errData = await response.json()
            if (typeof errData.detail === 'string') {
                errDetail = errData.detail
            } else if (Array.isArray(errData.detail)) {
                errDetail = errData.detail.map(d => `${d.loc ? d.loc.filter(l => l !== 'body').join('.') : 'field'}: ${d.msg || d.message}`).join(', ')
            } else if (Array.isArray(errData.errors)) {
                errDetail = errData.errors.map(e => `${e.field}: ${e.message}`).join(', ')
            } else if (errData.message) {
                errDetail = errData.message
            }
        } catch {
            // Non-JSON response body
        }
        if (response.status === 404) throw new Error(errDetail || 'The requested resource was not found.')
        if (response.status === 409) throw new Error(errDetail || 'A shipment with this ID already exists in the system.')
        if (response.status === 422) throw new Error(errDetail || 'Invalid shipment data. Please verify all required fields.')
        if (response.status >= 500) throw new Error(errDetail || 'Backend server is unavailable.')
        throw new Error(errDetail || `Request failed with status ${response.status}.`)
    }

    return response.status === 204 ? null : response.json()
}

export function normalizeShipment(shipment) {
    return {
        id: shipment.shipment_id,
        origin: shipment.origin,
        destination: shipment.destination,
        currentLocation: shipment.current_location,
        status: shipment.status,
        riskScore: shipment.risk_score,
        risk: shipment.risk_level,
        eta: shipment.eta,
        lastUpdated: shipment.last_updated,
        priority: shipment.priority,
        riskFactors: shipment.risk_factors || [],
    }
}

function shipmentPayload(data) {
    let cleanId = (data.shipment_id || data.id || '').trim().toUpperCase()
    if (cleanId && !cleanId.startsWith('SHP-')) {
        if (cleanId.startsWith('SHP')) {
            cleanId = 'SHP-' + cleanId.slice(3).replace(/^[-_ ]+/, '')
        } else {
            cleanId = `SHP-${cleanId}`
        }
    }

    const origin = (data.origin || '').trim()
    const destination = (data.destination || '').trim()
    const currentLocation = (data.current_location || data.currentLocation || origin || '').trim()

    return {
        shipment_id: cleanId,
        origin: origin,
        destination: destination,
        current_location: currentLocation,
        status: data.status || 'Booked',
        risk_score: typeof data.risk_score === 'number' ? data.risk_score : (typeof data.riskScore === 'number' ? data.riskScore : 10),
        risk_level: data.risk_level || data.risk || 'Low',
        eta: data.eta || data.expectedDelivery || 'TBD',
        last_updated: data.last_updated || data.lastUpdated || 'Just now',
        priority: data.priority || 'Standard',
        risk_factors: Array.isArray(data.risk_factors) && data.risk_factors.length > 0
            ? data.risk_factors
            : (Array.isArray(data.riskFactors) && data.riskFactors.length > 0
                ? data.riskFactors
                : ['New shipment awaiting monitoring']),
    }
}


export async function getShipments() {
    return (await request('/api/shipments')).map(normalizeShipment)
}

export async function getShipment(id) {
    return normalizeShipment(await request(`/api/shipments/${id}`))
}

export async function createShipment(data) {
    return normalizeShipment(
        await request('/api/shipments', {
            method: 'POST',
            body: JSON.stringify(shipmentPayload(data)),
        })
    )
}

export async function updateShipment(id, data) {
    return normalizeShipment(
        await request(`/api/shipments/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    )
}

export async function deleteShipment(id) {
    return request(`/api/shipments/${id}`, { method: 'DELETE' })
}

function normalizeAlert(alert) {
    return {
        id: alert.alert_id,
        shipment: alert.shipment_id,
        severity: alert.severity ? alert.severity[0] + alert.severity.slice(1).toLowerCase() : 'Medium',
        type: alert.type,
        title: alert.title,
        message: alert.message,
        action: alert.recommended_action,
        time: alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
        timestamp: alert.timestamp,
        read: alert.read,
    }
}

export async function getAlerts() {
    return (await request('/api/alerts')).map(normalizeAlert)
}

export async function getAlert(id) {
    return normalizeAlert(await request(`/api/alerts/${id}`))
}

export async function markAlertAsRead(id) {
    return normalizeAlert(await request(`/api/alerts/${id}/read`, { method: 'PUT' }))
}

export async function deleteAlert(id) {
    return request(`/api/alerts/${id}`, { method: 'DELETE' })
}

export async function getAnalyticsOverview() {
    return request('/api/analytics/overview')
}

export async function getRiskDistribution() {
    return request('/api/analytics/risk-distribution')
}

export async function getShipmentActivity() {
    return request('/api/analytics/activity')
}

export async function getPerformance() {
    return request('/api/analytics/performance')
}

export async function predictRisk(payload) {
    const body = typeof payload === 'string' ? { shipment_id: payload } : payload
    return request('/api/predictions/risk', {
        method: 'POST',
        body: JSON.stringify(body),
    })
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

export async function getSettings() {
    return request('/api/settings')
}

export async function updateSettings(data) {
    return request('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}

export async function getSystemConfig() {
    return request('/api/system/config')
}

export async function getSystemVersion() {
    return request('/api/system/version')
}

export async function getSystemMetrics() {
    return request('/api/system/metrics')
}

// ============================================================================
// Phase 8: WebSocket Real-Time Client Service
// ============================================================================

class WebSocketService {
    constructor() {
        this.socket = null
        this.listeners = new Map()
        this.reconnectAttempts = 0
        this.maxReconnectDelay = 10000
        this.reconnectTimer = null
        this.pingTimer = null
        this.isConnected = false
        this.isExplicitlyClosed = false
    }

    connect() {
        if (typeof window === 'undefined') return
        if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
            return
        }

        this.isExplicitlyClosed = false
        const wsUrl = getWsUrl()

        try {
            this.socket = new WebSocket(wsUrl)

            this.socket.onopen = () => {
                this.isConnected = true
                this.reconnectAttempts = 0
                this._notify('connection.status', { connected: true })
                this._startHeartbeat()
            }

            this.socket.onmessage = (event) => {
                try {
                    const parsed = JSON.parse(event.data)
                    const eventName = parsed.event || 'message'
                    this._notify(eventName, parsed.data || parsed)
                    this._notify('*', parsed)
                } catch {
                    // Ignore non-JSON
                }
            }

            this.socket.onerror = () => {
                // Handled in onclose
            }

            this.socket.onclose = () => {
                this.isConnected = false
                this._stopHeartbeat()
                this._notify('connection.status', { connected: false })
                if (!this.isExplicitlyClosed) {
                    this._scheduleReconnect()
                }
            }
        } catch {
            this._scheduleReconnect()
        }
    }

    _startHeartbeat() {
        this._stopHeartbeat()
        this.pingTimer = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({ type: 'ping' }))
            }
        }, 30000)
    }

    _stopHeartbeat() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer)
            this.pingTimer = null
        }
    }

    _scheduleReconnect() {
        if (this.reconnectTimer) return
        this.reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay)
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, delay)
    }

    subscribe(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set())
        }
        this.listeners.get(event).add(callback)

        if (!this.isConnected && (!this.socket || this.socket.readyState === WebSocket.CLOSED)) {
            this.connect()
        }

        return () => this.unsubscribe(event, callback)
    }

    unsubscribe(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback)
            if (this.listeners.get(event).size === 0) {
                this.listeners.delete(event)
            }
        }
    }

    _notify(event, data) {
        if (this.listeners.has(event)) {
            for (const cb of this.listeners.get(event)) {
                try {
                    cb(data)
                } catch (err) {
                    console.error(`[WebSocket] Listener error for ${event}:`, err)
                }
            }
        }
    }

    disconnect() {
        this.isExplicitlyClosed = true
        this._stopHeartbeat()
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        if (this.socket) {
            this.socket.close()
            this.socket = null
        }
        this.isConnected = false
    }
}

export const wsService = new WebSocketService()