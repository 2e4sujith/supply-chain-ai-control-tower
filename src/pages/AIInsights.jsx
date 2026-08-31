import { ArrowUpRight, BrainCircuit, CircleAlert, Lightbulb, ShieldCheck, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './AIInsights.css'

const insights = [
  {
    title: 'Elevated Risk Corridors',
    icon: CircleAlert,
    tone: 'red',
    headline: 'Asia-Pacific lanes need attention',
    text: 'Pacific Ocean routes account for 62% of current high-risk volume, driven by port congestion and weather exposure.',
    meta: '3 corridors flagged',
    action: 'Review corridors',
    target: '/map',
  },
  {
    title: 'Dominant Risk Factor',
    icon: TrendingUp,
    tone: 'orange',
    headline: 'Port congestion is the leading signal',
    text: 'Congestion contributes to 41% of modeled disruption exposure across active shipments this week.',
    meta: '41% of exposure',
    action: 'View risk drivers',
    target: '/analytics',
  },
  {
    title: 'Recommended Action',
    icon: Lightbulb,
    tone: 'green',
    headline: 'Pre-book alternate capacity',
    text: 'Secure transload capacity near Long Beach to protect the delivery window for priority Pacific shipments.',
    meta: 'Potential impact: High',
    action: 'Open action plan',
    target: '/alerts',
  },
  {
    title: 'Risk Trend',
    icon: TrendingUp,
    tone: 'blue',
    headline: 'Network risk is stabilizing',
    text: 'Overall risk has decreased for three consecutive days, while two weather-sensitive routes remain elevated.',
    meta: '-8.2% over 7 days',
    action: 'Explore trend',
    target: '/analytics',
  },
]

function AIInsights() {
  const navigate = useNavigate()

  return (
    <div className="insights-page">
      <section className="page-intro insights-intro">
        <div>
          <span className="eyebrow">Decision support</span>
          <h1>AI Insights</h1>
          <p>Signals and recommendations to help prioritize supply chain decisions.</p>
        </div>
        <span className="insight-badge">
          <BrainCircuit size={14} /> AI RISK INTELLIGENCE
        </span>
      </section>

      <div className="insight-banner">
        <ShieldCheck size={20} />
        <div>
          <strong>AI Risk Insights Active</strong>
          <p>Predictive disruption risk drivers aggregated across active shipments and transit corridors.</p>
        </div>
      </div>

      <section className="insight-grid">
        {insights.map(({ title, icon: Icon, tone, headline, text, meta, action, target }) => (
          <article className="insight-card" key={title}>
            <div className={`insight-icon ${tone}`}>
              <Icon size={18} />
            </div>
            <span className="eyebrow">{title}</span>
            <h2>{headline}</h2>
            <p>{text}</p>
            <div className="insight-card-footer">
              <strong>{meta}</strong>
              <button type="button" onClick={() => navigate(target)}>
                {action} <ArrowUpRight size={13} />
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

export default AIInsights
