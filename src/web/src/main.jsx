import './polyfills';
import React from 'react'
import ReactDOM from 'react-dom/client'
import Navigation from './Navigation.jsx'
import SubmitForm from './SubmitForm.jsx'

const navigation = document.getElementById('navigation');
ReactDOM.createRoot(navigation).render(
  <React.StrictMode>
    <Navigation />
  </React.StrictMode>,
)
const submitForm = document.getElementById('submit-form');
if (submitForm) {
  ReactDOM.createRoot(submitForm).render(
    <React.StrictMode>
      <SubmitForm />
    </React.StrictMode>,
  )
}
