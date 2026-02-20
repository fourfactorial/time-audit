import React from 'react'
import ReactDOM from 'react-dom/client'
import './global.css'
import App from './App'
import { AppProvider } from './store/AppContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
)

// Service worker is registered automatically by vite-plugin-pwa via injectRegister: 'auto'.
// No manual registration needed here.
