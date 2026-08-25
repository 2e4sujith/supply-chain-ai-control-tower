import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react'

function ShipmentTable({ shipments, sortConfig, onSort, onSelect }) {
  const columns = [
    ['id', 'Shipment ID'], ['origin', 'Origin'], ['destination', 'Destination'], ['currentLocation', 'Current Location'], ['status', 'Status'], ['risk', 'Risk'], ['eta', 'ETA'], ['lastUpdated', 'Last Updated'],
  ]

  return (
    <div className="shipment-table-wrap"><table className="shipment-table"><thead><tr>{columns.map(([key, label]) => <th key={key}><button className="sort-button" onClick={() => onSort(key)}>{label}{sortConfig.key === key ? (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />}</button></th>)}<th aria-label="Open shipment" /></tr></thead><tbody>{shipments.map((shipment) => <tr key={shipment.id} onClick={() => onSelect(shipment.id)}><td><strong>{shipment.id}</strong></td><td>{shipment.origin}</td><td>{shipment.destination}</td><td>{shipment.currentLocation}</td><td><span className={`shipment-status ${shipment.status.toLowerCase().replace(' ', '-')}`}>{shipment.status}</span></td><td><span className={`shipment-risk ${shipment.risk.toLowerCase()}`}><span />{shipment.risk}</span></td><td>{shipment.eta}</td><td>{shipment.lastUpdated}</td><td><ChevronRight size={15} /></td></tr>)}</tbody></table>{shipments.length === 0 && <div className="empty-state">No shipments match the current filters.</div>}</div>
  )
}

export default ShipmentTable
