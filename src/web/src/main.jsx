import './polyfills';
import React from 'react'
import ReactDOM from 'react-dom/client'
import Navigation from './Navigation.jsx'
import SubmitForm from './SubmitForm.jsx'
import Vote from './Vote.jsx'
import EnsName from './EnsName.jsx'

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

const voteArrows = document.querySelectorAll('.votearrowcontainer');
if (voteArrows && voteArrows.length > 0) {
  voteArrows.forEach(arrow => {
    const title = arrow.getAttribute("data-title");
    const href = arrow.getAttribute("data-href");
    ReactDOM.createRoot(arrow).render(
      <React.StrictMode>
        <Vote title={title} href={href} />
      </React.StrictMode>,
    )
  });
}

const ensNameComponents = document.querySelectorAll("ens-name");
if (ensNameComponents) {
  for (let elem of ensNameComponents) {
    const address = elem.getAttribute("address");
    ReactDOM.createRoot(elem).render(
      <React.StrictMode>
        <EnsName address={address} />
      </React.StrictMode>,
    );
  }
}
