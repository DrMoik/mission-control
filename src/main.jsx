// Ensure constants run first; load App dynamically to avoid TDZ in bundle evaluation
import './constants.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import { setupNativeRuntime } from './mobile/nativeRuntime.js'

async function init() {
  await setupNativeRuntime()
  const { default: App } = await import('./App.jsx')
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>,
  )
}
init()
