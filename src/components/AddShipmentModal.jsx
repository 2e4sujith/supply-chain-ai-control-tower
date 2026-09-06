import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

const initialForm = {
  id: '',
  origin: '',
  destination: '',
  currentLocation: '',
  priority: 'Standard',
  expectedDelivery: '',
}

function AddShipmentModal({ onClose, onCreate, disabled = false, error = '' }) {
  const [form, setForm] = useState(initialForm)

  const update = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const submit = (event) => {
    event.preventDefault()
    let rawId = (form.id || '').trim().toUpperCase()
    if (rawId && !rawId.startsWith('SHP-')) {
      if (rawId.startsWith('SHP')) {
        rawId = 'SHP-' + rawId.slice(3).replace(/^[-_ ]+/, '')
      } else {
        rawId = `SHP-${rawId}`
      }
    }

    const payload = {
      id: rawId,
      shipment_id: rawId,
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      currentLocation: (form.currentLocation || form.origin || '').trim(),
      current_location: (form.currentLocation || form.origin || '').trim(),
      priority: form.priority,
      status: 'Booked',
      risk: 'Low',
      risk_level: 'Low',
      riskScore: 12,
      risk_score: 12,
      eta: form.expectedDelivery || 'TBD',
      expectedDelivery: form.expectedDelivery || 'TBD',
      lastUpdated: 'Just now',
      last_updated: 'Just now',
      riskFactors: ['New shipment awaiting monitoring'],
      risk_factors: ['New shipment awaiting monitoring'],
    }

    onCreate(payload)
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="shipment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-shipment-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Control Tower</span>
            <h2 id="add-shipment-title">Add Shipment</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="inline-error modal-error" style={{ margin: '12px 0', fontSize: '11px' }}>
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Shipment ID
              <input
                name="id"
                value={form.id}
                onChange={update}
                placeholder="e.g. SHP-2050 or 2050"
                required
                disabled={disabled}
              />
            </label>
            <label>
              Origin
              <input
                name="origin"
                value={form.origin}
                onChange={update}
                placeholder="City, Country (e.g. Tokyo, JP)"
                required
                disabled={disabled}
              />
            </label>
            <label>
              Destination
              <input
                name="destination"
                value={form.destination}
                onChange={update}
                placeholder="City, Country (e.g. Los Angeles, US)"
                required
                disabled={disabled}
              />
            </label>
            <label>
              Current Location
              <input
                name="currentLocation"
                value={form.currentLocation}
                onChange={update}
                placeholder="Current location (defaults to origin)"
                disabled={disabled}
              />
            </label>
            <label>
              Priority
              <select
                name="priority"
                value={form.priority}
                onChange={update}
                disabled={disabled}
              >
                <option value="Standard">Standard</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </label>
            <label>
              Expected Delivery
              <input
                name="expectedDelivery"
                type="datetime-local"
                value={form.expectedDelivery}
                onChange={update}
                required
                disabled={disabled}
              />
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              disabled={disabled}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={disabled}
              type="submit"
            >
              {disabled ? 'Creating...' : 'Create shipment'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default AddShipmentModal
