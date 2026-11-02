import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { initUpdater } from './updater'

initUpdater()

createRoot(document.getElementById('root')).render(<App />)
