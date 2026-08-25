import { X } from 'lucide-react'
import { useState } from 'react'

const initialForm = { id: '', origin: '', destination: '', currentLocation: '', priority: 'Standard', expectedDelivery: '' }

function AddShipmentModal({ onClose, onCreate, disabled = false }) {
  const [form, setForm] = useState(initialForm)
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const submit = (event) => { event.preventDefault(); onCreate({ ...form, status: 'Booked', risk: 'Low', riskScore: 12, eta: form.expectedDelivery, lastUpdated: 'Just now', riskFactors: ['New shipment awaiting monitoring'] }); setForm(initialForm) }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="shipment-modal" role="dialog" aria-modal="true" aria-labelledby="add-shipment-title"><div className="modal-heading"><div><span className="eyebrow">Demo workspace</span><h2 id="add-shipment-title">Add Shipment</h2></div><button className="close-button" onClick={onClose} aria-label="Close modal"><X size={18} /></button></div><form onSubmit={submit}><div className="form-grid">{[['id', 'Shipment ID', 'SHP-0000'], ['origin', 'Origin', 'City, Country'], ['destination', 'Destination', 'City, Country'], ['currentLocation', 'Current Location', 'Current location']].map(([name, label, placeholder]) => <label key={name}>{label}<input name={name} value={form[name]} onChange={update} placeholder={placeholder} required /></label>)}<label>Priority<select name="priority" value={form.priority} onChange={update}><option>Standard</option><option>High</option><option>Urgent</option></select></label><label>Expected Delivery<input name="expectedDelivery" type="datetime-local" value={form.expectedDelivery} onChange={update} required /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={disabled} type="submit">{disabled ? 'Creating...' : 'Create shipment'}</button></div></form></section></div>
}

export default AddShipmentModal
