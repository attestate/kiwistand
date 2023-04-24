import './polyfills';
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const connector = document.getElementById('connector');
ReactDOM.createRoot(connector).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
