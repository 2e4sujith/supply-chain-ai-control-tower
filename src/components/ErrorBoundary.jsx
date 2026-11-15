import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }
      return (
        <div
          style={{
            padding: '24px',
            background: '#ffffff',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            color: '#dc2626',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: this.props.minHeight || '320px',
            gap: '12px',
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={32} color="#dc2626" />
          <strong style={{ fontSize: '15px', color: '#0f172a' }}>
            {this.props.title || 'Component could not be loaded'}
          </strong>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b', maxWidth: '480px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred. You can retry safely.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            <RefreshCw size={13} /> {this.props.resetLabel || 'Retry'}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
