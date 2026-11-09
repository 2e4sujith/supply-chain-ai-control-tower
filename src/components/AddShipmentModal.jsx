import { useState } from 'react'
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  Plane,
  RefreshCw,
  Sliders,
  Sparkles,
  Train,
  Truck,
  X,
} from 'lucide-react'
import './AddShipmentModal.css'

const POPULAR_HUBS = [
  'Vijayawada, India',
  'Nellore, India',
  'Guntur, India',
  'Hanuman Junction, India',
  'Visakhapatnam, India',
  'Chennai, India',
  'Hyderabad, India',
  'Mumbai, India',
  'Rotterdam, Netherlands',
  'Hamburg, Germany',
  'Frankfurt, Germany',
  'Antwerp, Belgium',
  'Shanghai, China',
  'Ningbo, China',
  'Singapore, Singapore',
  'Busan, South Korea',
  'Tokyo, Japan',
  'Los Angeles, United States',
  'Long Beach, United States',
  'Chicago, United States',
  'Dallas, United States',
  'New York, United States',
  'Seattle, United States',
]

function generateDefaultId() {
  const num = Math.floor(2000 + Math.random() * 8000)
  return `SHP-${num}`
}

function getDefaultDates() {
  const now = new Date()
  const departure = new Date(now.getTime() + 2 * 3600 * 1000)
  const delivery = new Date(now.getTime() + 74 * 3600 * 1000)

  const toInputStr = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return {
    departure: toInputStr(departure),
    delivery: toInputStr(delivery),
  }
}

export default function AddShipmentModal({ onClose, onCreate, disabled = false, error = '' }) {
  const defaultDates = getDefaultDates()

  const [step, setStep] = useState(1) // 1: Basic, 2: Logistics, 3: Review
  const [success, setSuccess] = useState(false)
  const [formError, setFormError] = useState('')

  const [form, setForm] = useState({
    id: generateDefaultId(),
    productName: 'Precision Microcontrollers & Sensors',
    origin: 'Vijayawada, India',
    destination: 'Nellore, India',
    currentLocation: '',
    transportMode: 'Road',
    priority: 'Standard',
    departureDate: defaultDates.departure,
    deliveryDate: defaultDates.delivery,
  })

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormError('')
  }

  const validateStep1 = () => {
    const cleanId = form.id.trim()
    if (!cleanId) {
      setFormError('Shipment ID is required.')
      return false
    }
    if (!form.productName.trim()) {
      setFormError('Product or Cargo name is required.')
      return false
    }
    if (!form.origin.trim()) {
      setFormError('Origin location is required.')
      return false
    }
    if (!form.destination.trim()) {
      setFormError('Destination location is required.')
      return false
    }
    if (form.origin.trim().toLowerCase() === form.destination.trim().toLowerCase()) {
      setFormError('Origin and Destination cannot be the same hub.')
      return false
    }
    return true
  }

  const validateStep2 = () => {
    if (!form.deliveryDate) {
      setFormError('Estimated delivery date is required.')
      return false
    }
    if (form.departureDate && form.deliveryDate && new Date(form.deliveryDate) <= new Date(form.departureDate)) {
      setFormError('Delivery date must be later than departure date.')
      return false
    }
    return true
  }

  const handleNext = () => {
    setFormError('')
    if (step === 1) {
      if (validateStep1()) setStep(2)
    } else if (step === 2) {
      if (validateStep2()) setStep(3)
    }
  }

  const handleBack = () => {
    setFormError('')
    if (step > 1) setStep(step - 1)
  }

  const handleFinalSubmit = (e) => {
    if (e) e.preventDefault()
    setFormError('')

    let rawId = form.id.trim().toUpperCase()
    if (rawId && !rawId.startsWith('SHP-')) {
      if (rawId.startsWith('SHP')) {
        rawId = 'SHP-' + rawId.slice(3).replace(/^[-_ ]+/, '')
      } else {
        rawId = `SHP-${rawId}`
      }
    }

    // Format readable delivery date (e.g. Aug 28, 14:00)
    let etaFormatted = 'TBD'
    if (form.deliveryDate) {
      try {
        const d = new Date(form.deliveryDate)
        etaFormatted = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      } catch {
        etaFormatted = form.deliveryDate
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
      eta: etaFormatted,
      expectedDelivery: etaFormatted,
      lastUpdated: 'Just now',
      last_updated: 'Just now',
      riskFactors: [
        `Cargo: ${form.productName.trim()}`,
        `Mode: ${form.transportMode} Freight`,
        'Initial baseline score: Awaiting live disruption monitoring',
      ],
      risk_factors: [
        `Cargo: ${form.productName.trim()}`,
        `Mode: ${form.transportMode} Freight`,
        'Initial baseline score: Awaiting live disruption monitoring',
      ],
    }

    setSuccess(true)
    setTimeout(() => {
      onCreate(payload)
    }, 900)
  }

  return (
    <div
      className="shipment-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <datalist id="popular-hubs-list">
        {POPULAR_HUBS.map((hub) => (
          <option key={hub} value={hub} />
        ))}
      </datalist>

      <section
        className="shipment-wizard-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-shipment-title"
      >
        {/* Modal Header */}
        <div className="wizard-modal-header">
          <div className="wizard-modal-title-group">
            <span className="eyebrow">Control Tower Dispatch</span>
            <h2 id="add-shipment-title">Create New Shipment</h2>
          </div>
          <button className="wizard-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {/* Stepper Progress Indicator */}
        {!success && (
          <div className="wizard-stepper-bar">
            <button
              type="button"
              className={`wizard-step-indicator ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}
              onClick={() => step > 1 && setStep(1)}
            >
              <span className="wizard-step-circle">
                {step > 1 ? <Check size={12} /> : '1'}
              </span>
              <div className="wizard-step-label">
                <span className="step-num-text">Step 1</span>
                <span className="step-name-text">Basic Details</span>
              </div>
            </button>

            <span className="wizard-step-divider" />

            <button
              type="button"
              className={`wizard-step-indicator ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}
              onClick={() => {
                if (validateStep1()) setStep(2)
              }}
            >
              <span className="wizard-step-circle">
                {step > 2 ? <Check size={12} /> : '2'}
              </span>
              <div className="wizard-step-label">
                <span className="step-num-text">Step 2</span>
                <span className="step-name-text">Logistics</span>
              </div>
            </button>

            <span className="wizard-step-divider" />

            <button
              type="button"
              className={`wizard-step-indicator ${step === 3 ? 'active' : ''}`}
              onClick={() => {
                if (validateStep1() && validateStep2()) setStep(3)
              }}
            >
              <span className="wizard-step-circle">3</span>
              <div className="wizard-step-label">
                <span className="step-num-text">Step 3</span>
                <span className="step-name-text">Review & Create</span>
              </div>
            </button>
          </div>
        )}

        {/* Error Notification */}
        {(formError || error) && (
          <div className="inline-error" style={{ margin: '12px 24px 0', fontSize: '12px' }}>
            <AlertTriangle size={15} />
            <span>{formError || error}</span>
          </div>
        )}

        {/* Success State */}
        {success ? (
          <div className="wizard-success-state">
            <div className="success-check-icon">
              <CheckCircle2 size={32} />
            </div>
            <h3>Shipment {form.id} Created!</h3>
            <p>
              Successfully registered <strong>{form.productName}</strong> on corridor{' '}
              <strong>{form.origin}</strong> → <strong>{form.destination}</strong>. Ingesting into real-time Control Tower telemetry...
            </p>
          </div>
        ) : (
          <div className="wizard-modal-body">
            {/* STEP 1: Basic Shipment Details */}
            {step === 1 && (
              <>
                <div className="wizard-step-title">
                  <h3>Step 1 — Basic Shipment Details</h3>
                  <p>Define cargo identifier, merchandise, and origin/destination corridors.</p>
                </div>

                <div className="wizard-form-grid">
                  <div className="wizard-field-group">
                    <label htmlFor="shipment-id">
                      Shipment ID
                      <span
                        className="field-hint-action"
                        onClick={() => handleChange('id', generateDefaultId())}
                        title="Generate random identifier"
                      >
                        Auto-generate
                      </span>
                    </label>
                    <input
                      id="shipment-id"
                      value={form.id}
                      onChange={(e) => handleChange('id', e.target.value)}
                      placeholder="e.g. SHP-2055"
                      required
                      disabled={disabled}
                    />
                  </div>

                  <div className="wizard-field-group">
                    <label htmlFor="cargo-name">Cargo / Product Name</label>
                    <input
                      id="cargo-name"
                      value={form.productName}
                      onChange={(e) => handleChange('productName', e.target.value)}
                      placeholder="e.g. Industrial Microcontrollers"
                      required
                      disabled={disabled}
                    />
                  </div>

                  <div className="wizard-field-group">
                    <label htmlFor="origin-hub">Origin Logistics Hub</label>
                    <input
                      id="origin-hub"
                      list="popular-hubs-list"
                      value={form.origin}
                      onChange={(e) => handleChange('origin', e.target.value)}
                      placeholder="Select or enter City, Country"
                      required
                      disabled={disabled}
                    />
                  </div>

                  <div className="wizard-field-group">
                    <label htmlFor="dest-hub">Destination Logistics Hub</label>
                    <input
                      id="dest-hub"
                      list="popular-hubs-list"
                      value={form.destination}
                      onChange={(e) => handleChange('destination', e.target.value)}
                      placeholder="Select or enter City, Country"
                      required
                      disabled={disabled}
                    />
                  </div>
                </div>
              </>
            )}

            {/* STEP 2: Logistics Details */}
            {step === 2 && (
              <>
                <div className="wizard-step-title">
                  <h3>Step 2 — Logistics & Schedule Details</h3>
                  <p>Select multimodal transport method, priority level, and timeline.</p>
                </div>

                <div className="wizard-field-group">
                  <label>Transport Mode</label>
                  <div className="transport-mode-grid">
                    {[
                      { id: 'Road', label: 'Road Express', icon: Truck },
                      { id: 'Ocean', label: 'Ocean Freight', icon: Anchor },
                      { id: 'Air', label: 'Air Cargo', icon: Plane },
                      { id: 'Rail', label: 'Rail Intermodal', icon: Train },
                    ].map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        className={`mode-radio-card ${form.transportMode === id ? 'selected' : ''}`}
                        onClick={() => handleChange('transportMode', id)}
                      >
                        <Icon size={20} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="wizard-field-group">
                  <label>Operational Priority</label>
                  <div className="priority-pill-grid">
                    {[
                      { id: 'Standard', label: 'Standard Priority', class: 'standard' },
                      { id: 'High', label: 'High Priority', class: 'high' },
                      { id: 'Urgent', label: 'Urgent / Critical', class: 'urgent' },
                    ].map(({ id, label, class: cls }) => (
                      <button
                        key={id}
                        type="button"
                        className={`priority-pill-btn ${cls} ${form.priority === id ? 'selected' : ''}`}
                        onClick={() => handleChange('priority', id)}
                      >
                        <Clock size={14} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="wizard-form-grid" style={{ marginTop: '4px' }}>
                  <div className="wizard-field-group">
                    <label htmlFor="departure-date">Scheduled Departure</label>
                    <input
                      id="departure-date"
                      type="datetime-local"
                      value={form.departureDate}
                      onChange={(e) => handleChange('departureDate', e.target.value)}
                      disabled={disabled}
                    />
                  </div>

                  <div className="wizard-field-group">
                    <label htmlFor="delivery-date">Estimated Delivery (ETA)</label>
                    <input
                      id="delivery-date"
                      type="datetime-local"
                      value={form.deliveryDate}
                      onChange={(e) => handleChange('deliveryDate', e.target.value)}
                      required
                      disabled={disabled}
                    />
                  </div>
                </div>
              </>
            )}

            {/* STEP 3: Review and Create */}
            {step === 3 && (
              <>
                <div className="wizard-step-title">
                  <h3>Step 3 — Review & Create</h3>
                  <p>Verify all shipment specifications before registering into the live network.</p>
                </div>

                <div className="wizard-review-card">
                  <div className="review-route-banner">
                    <div className="review-hub-box">
                      <span className="hub-role">Origin</span>
                      <span className="hub-name">{form.origin}</span>
                    </div>

                    <div className="review-route-arrow">
                      <ArrowRight size={20} />
                    </div>

                    <div className="review-hub-box" style={{ textAlign: 'right' }}>
                      <span className="hub-role">Destination</span>
                      <span className="hub-name">{form.destination}</span>
                    </div>
                  </div>

                  <div className="review-specs-grid">
                    <div className="review-spec-item">
                      <span className="review-spec-label">Shipment ID</span>
                      <span className="review-spec-value" style={{ color: 'var(--color-blue)', fontFamily: 'var(--font-mono)' }}>
                        {form.id}
                      </span>
                    </div>

                    <div className="review-spec-item">
                      <span className="review-spec-label">Cargo / Product</span>
                      <span className="review-spec-value">{form.productName}</span>
                    </div>

                    <div className="review-spec-item">
                      <span className="review-spec-label">Transport Mode</span>
                      <span className="review-spec-value">
                        {form.transportMode === 'Road' && <Truck size={14} />}
                        {form.transportMode === 'Ocean' && <Anchor size={14} />}
                        {form.transportMode === 'Air' && <Plane size={14} />}
                        {form.transportMode === 'Rail' && <Train size={14} />}
                        {form.transportMode} Freight
                      </span>
                    </div>

                    <div className="review-spec-item">
                      <span className="review-spec-label">Priority Tier</span>
                      <span className="review-spec-value">
                        <span className={`inspector-risk-tag ${form.priority === 'Urgent' ? 'critical' : form.priority === 'High' ? 'high' : 'low'}`}>
                          {form.priority}
                        </span>
                      </span>
                    </div>

                    <div className="review-spec-item">
                      <span className="review-spec-label">Target ETA</span>
                      <span className="review-spec-value" style={{ fontFamily: 'var(--font-mono)' }}>
                        {form.deliveryDate ? new Date(form.deliveryDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}
                      </span>
                    </div>

                    <div className="review-spec-item">
                      <span className="review-spec-label">Network Status</span>
                      <span className="review-spec-value" style={{ color: '#16a34a' }}>
                        <CheckCircle2 size={14} /> Ready for Ingestion
                      </span>
                    </div>
                  </div>

                  <div className="review-ai-assessment">
                    <Sparkles size={16} />
                    <div>
                      <strong>AI Predictive Risk Assessment:</strong> Baseline risk indexed at{' '}
                      <strong>12/100 (Low Risk)</strong>. Once created, XGBoost disruption models and GCN topology will continuously track this corridor.
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Wizard Footer Actions */}
        {!success && (
          <div className="wizard-modal-footer">
            {step > 1 ? (
              <button
                type="button"
                className="wizard-back-btn"
                onClick={handleBack}
                disabled={disabled}
              >
                Back
              </button>
            ) : (
              <button
                type="button"
                className="wizard-back-btn"
                onClick={onClose}
                disabled={disabled}
              >
                Cancel
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                className="wizard-next-btn"
                onClick={handleNext}
                disabled={disabled}
              >
                <span>Continue</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="wizard-next-btn"
                onClick={handleFinalSubmit}
                disabled={disabled}
              >
                {disabled ? (
                  <>
                    <RefreshCw size={14} className="loading-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Package size={14} />
                    <span>Confirm & Create Shipment</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
