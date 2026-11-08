import { Globe2, RefreshCw } from 'lucide-react'
import './SceneFallback.css'

export default function SceneFallback({ message = '3D Digital Twin initialising...', isError = false, onRetry }) {
  return (
    <div className={`scene-fallback-container ${isError ? 'error-state' : 'loading-state'}`}>
      <div className="fallback-hologram">
        <div className="hologram-ring outer" />
        <div className="hologram-ring middle" />
        <div className="hologram-core">
          <Globe2 size={36} className="core-icon" />
        </div>
      </div>
      <span className="fallback-text">{message}</span>
      {isError && onRetry && (
        <button type="button" className="fallback-retry-btn" onClick={onRetry}>
          <RefreshCw size={13} /> Reinitialise Canvas
        </button>
      )}
    </div>
  )
}
