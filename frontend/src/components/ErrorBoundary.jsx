import { Component } from 'react'

/**
 * Top-level error boundary.
 * Catches React reconciler crashes (e.g. browser translation extension DOM interference)
 * and shows a recovery prompt instead of a blank page.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Log to console so it still appears in browser devtools
    console.error('[ErrorBoundary] Uncaught render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', gap: 16, padding: 32, fontFamily: 'sans-serif', color: '#1e293b',
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Algo salió mal</div>
          <div style={{ fontSize: 15, color: '#64748b', textAlign: 'center', maxWidth: 420 }}>
            Ocurrió un error inesperado. Por favor recargue la página para continuar.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '10px 28px', borderRadius: 8, border: 'none',
              background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer',
            }}
          >
            Recargar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
