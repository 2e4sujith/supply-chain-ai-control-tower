import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react'

function ShipmentTable({ shipments, sortConfig, onSort, onSelect }) {
  const columns = [
    ['id', 'Shipment ID'],
    ['origin', 'Origin Hub'],
    ['destination', 'Destination Corridor'],
    ['currentLocation', 'Current Telemetry'],
    ['status', 'Movement Status'],
    ['risk', 'Disruption Risk'],
    ['eta', 'Estimated ETA'],
    ['lastUpdated', 'Last Telemetry'],
  ]

  return (
    <div className="shipment-table-wrap">
      <table className="shipment-table">
        <thead>
          <tr>
            {columns.map(([key, label]) => (
              <th key={key}>
                <button
                  type="button"
                  className="sort-button"
                  onClick={() => onSort(key)}
                >
                  {label}
                  {sortConfig.key === key ? (
                    sortConfig.direction === 'asc' ? (
                      <ArrowUp size={12} />
                    ) : (
                      <ArrowDown size={12} />
                    )
                  ) : (
                    <ArrowUpDown size={12} className="sort-idle" />
                  )}
                </button>
              </th>
            ))}
            <th aria-label="Open shipment" className="arrow-th" />
          </tr>
        </thead>
        <tbody>
          {shipments.map((shipment) => (
            <tr key={shipment.id} onClick={() => onSelect(shipment.id)}>
              <td className="id-cell">
                <strong>{shipment.id}</strong>
              </td>
              <td>{shipment.origin}</td>
              <td>{shipment.destination}</td>
              <td className="location-cell">{shipment.currentLocation}</td>
              <td>
                <span className={`shipment-status ${shipment.status.toLowerCase().replace(/\s+/g, '-')}`}>
                  {shipment.status}
                </span>
              </td>
              <td>
                <span className={`shipment-risk ${shipment.risk.toLowerCase()}`}>
                  <span className="risk-dot" />
                  {shipment.risk}
                </span>
              </td>
              <td className="mono-cell">{shipment.eta}</td>
              <td className="time-cell">{shipment.lastUpdated}</td>
              <td className="arrow-td">
                <ChevronRight size={15} className="row-chevron" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shipments.length === 0 && (
        <div className="empty-state">No shipments match the specified search or filter criteria.</div>
      )}
    </div>
  )
}

export default ShipmentTable

