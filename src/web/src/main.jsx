import './polyfills';
import React from 'react'
import ReactDOM from 'react-dom/client'
import Connector from './Connector.jsx'

const connector = document.getElementById('connector');
ReactDOM.createRoot(connector).render(
  <React.StrictMode>
    <Connector />
  </React.StrictMode>,
)
