import { Component, type ErrorInfo, type ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

type BoundaryProps = { children: ReactNode }
type BoundaryState = { err: Error | null }

class RootErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { err: null }

  static getDerivedStateFromError(err: Error): BoundaryState {
    return { err }
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error(err, info.componentStack)
  }

  render() {
    if (this.state.err) {
      return (
        <div className="min-h-screen bg-fo-black p-8 text-zinc-200 font-sans">
          <h1 className="text-xl text-fo-gold-soft">Command centre could not load</h1>
          <pre className="mt-4 max-w-3xl whitespace-pre-wrap rounded-lg border border-fo-border bg-fo-panel p-4 text-sm text-fo-red">
            {this.state.err.message}
          </pre>
          <p className="mt-4 max-w-xl text-sm text-zinc-500">
            Open the browser developer console (F12) for the full stack. If you are stuck after an upgrade, try a hard refresh or
            clear site data for this origin, then open <span className="font-mono text-zinc-400">/login</span> again.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Missing #root element in index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
