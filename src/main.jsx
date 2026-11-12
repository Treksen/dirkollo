import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { initUpdater } from './updater'
import { installErrorReporting } from './errors'
import { ErrorBoundary } from './ErrorBoundary'

initUpdater()
installErrorReporting()

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>)
