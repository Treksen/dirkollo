import { Component } from 'react'
import { reportError } from './errors'

// If a screen crashes, show a friendly message instead of a blank page, and tell the Admin.
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false } }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { reportError(error, 'screen') }
  render() {
    if (!this.state.failed) return this.props.children
    const box = (
      <div className="card">
        <h2>Something went wrong</h2>
        <p style={{ lineHeight: 1.55, marginTop: 8 }}>{this.props.page ? 'This page hit a problem' : 'The app hit a problem'} and the Admin has been told. Your saved changes are safe.</p>
        <button className="btn p" style={{ marginTop: 14 }} onClick={() => location.reload()}>Reload</button>
      </div>
    )
    return this.props.page ? box : <div id="lg" className="show"><div className="lgwrap"><div className="lgmain">{box}</div></div></div>
  }
}
