import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// A render error used to blank the whole page with nothing but a console
// message. This catches it and shows the operator what happened, with a way to
// recover, instead of an unexplained white screen.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-lg w-full rounded-xl border border-rose-500/40 bg-slate-900 p-6 text-slate-200">
          <h1 className="text-lg font-bold text-rose-300">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-400">
            The screen could not be drawn. The details below help identify the cause.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-rose-200 whitespace-pre-wrap">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => { window.location.href = window.location.pathname }}
            className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
          >
            Reload the app
          </button>
        </div>
      </div>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
