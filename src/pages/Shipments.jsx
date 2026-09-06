import { AlertTriangle, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AddShipmentModal from '../components/AddShipmentModal.jsx'
import ShipmentTable from '../components/ShipmentTable.jsx'
import { shipmentRisks, shipmentStatuses } from '../data/shipments.js'
import { createShipment, getShipments, normalizeShipment, wsService } from '../services/api.js'
import './Shipments.css'

function Shipments() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') || ''

  const [shipments, setShipments] = useState([])
  const [search, setSearch] = useState(initialSearch)
  const [status, setStatus] = useState(shipmentStatuses[0])
  const [risk, setRisk] = useState(shipmentRisks[0])
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setShipments(await getShipments())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const urlQuery = searchParams.get('search')
    if (urlQuery !== null && urlQuery !== undefined) {
      setSearch(urlQuery)
    }
  }, [searchParams])

  useEffect(() => {
    const unsubCreated = wsService.subscribe('shipment.created', (data) => {
      const normalized = normalizeShipment(data)
      setShipments((current) => {
        if (current.some((s) => s.id === normalized.id)) return current
        return [normalized, ...current]
      })
    })

    const unsubUpdated = wsService.subscribe('shipment.updated', (data) => {
      const normalized = normalizeShipment(data)
      setShipments((current) => current.map((s) => (s.id === normalized.id ? { ...s, ...normalized } : s)))
    })

    const unsubRisk = wsService.subscribe('risk.updated', (data) => {
      if (!data.shipment_id) return
      setShipments((current) =>
        current.map((s) => (s.id === data.shipment_id ? { ...s, riskScore: data.risk_score, risk: data.risk_level } : s))
      )
    })

    const unsubDeleted = wsService.subscribe('shipment.deleted', (data) => {
      if (!data.shipment_id) return
      setShipments((current) => current.filter((s) => s.id !== data.shipment_id))
    })

    return () => {
      unsubCreated()
      unsubUpdated()
      unsubRisk()
      unsubDeleted()
    }
  }, [])

  const filteredShipments = useMemo(
    () =>
      shipments
        .filter((shipment) => {
          const query = search.toLowerCase()
          return (
            [shipment.id, shipment.origin, shipment.destination, shipment.currentLocation].some((field) =>
              field.toLowerCase().includes(query)
            ) &&
            (status === 'All statuses' || shipment.status === status) &&
            (risk === 'All risks' || shipment.risk === risk)
          )
        })
        .sort((left, right) =>
          String(left[sortConfig.key]).localeCompare(String(right[sortConfig.key]), undefined, { numeric: true }) *
          (sortConfig.direction === 'asc' ? 1 : -1)
        ),
    [risk, search, shipments, sortConfig, status]
  )

  const handleCreate = async (shipment) => {
    setSaving(true)
    setModalError('')
    setError('')
    try {
      const created = await createShipment(shipment)
      setShipments((current) => {
        if (current.some((s) => s.id === created.id)) return current
        return [created, ...current]
      })
      setIsModalOpen(false)
    } catch (err) {
      setModalError(err.message || 'Unable to create shipment.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-loading">
        <RefreshCw size={20} className="loading-spin" /> Loading shipments...
      </div>
    )
  }

  return (
    <div className="shipments-page">
      <section className="shipments-intro">
        <div>
          <span className="eyebrow">Network operations</span>
          <h1>Shipments</h1>
          <p>Track and manage every movement across your supply chain.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            setModalError('')
            setIsModalOpen(true)
          }}
        >
          <Plus size={17} /> Add Shipment
        </button>
      </section>

      {error && (
        <div className="inline-error">
          <AlertTriangle size={15} /> {error}
          <button onClick={load}>Retry</button>
        </div>
      )}

      <section className="shipment-toolbar">
        <label className="shipment-search">
          <Search size={16} />
          <span className="sr-only">Search shipments</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search shipments, routes or locations"
          />
        </label>
        <div className="filter-group">
          <SlidersHorizontal size={15} />
          <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
            {shipmentStatuses.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <select aria-label="Filter by risk" value={risk} onChange={(event) => setRisk(event.target.value)}>
            {shipmentRisks.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <span className="result-count">
          {filteredShipments.length} of {shipments.length} shipments
        </span>
      </section>

      <section className="shipment-table-panel">
        <div className="table-panel-heading">
          <div>
            <span className="eyebrow">Live register</span>
            <h2>Shipment register</h2>
          </div>
          <span className="demo-note">
            <span /> PostgreSQL data
          </span>
        </div>
        <ShipmentTable
          shipments={filteredShipments}
          sortConfig={sortConfig}
          onSort={(key) =>
            setSortConfig((current) => ({
              key,
              direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
            }))
          }
          onSelect={(id) => navigate(`/shipments/${id}`)}
        />
      </section>

      {isModalOpen && (
        <AddShipmentModal
          disabled={saving}
          error={modalError}
          onClose={() => {
            setModalError('')
            setIsModalOpen(false)
          }}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}

export default Shipments
