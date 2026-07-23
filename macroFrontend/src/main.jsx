// Standard Vite/React entry point — mounts the single top-level <App />
// (which handles its own internal screen routing: auth, onboarding, main app).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
