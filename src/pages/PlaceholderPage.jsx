import { Construction } from 'lucide-react'
import './PlaceholderPage.css'

function PlaceholderPage({ title }) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-icon"><Construction size={24} /></div>
      <span className="eyebrow">Workspace module</span>
      <h1>{title}</h1>
      <p>This workspace is ready for the next phase of the control tower.</p>
    </div>
  )
}

export default PlaceholderPage
