
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import AuthProvider from './auth/AuthProvider'
import { service } from './services'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider service={service}><App /></AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
