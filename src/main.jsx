import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './assets/global.css'

// Applique le thème avant le rendu pour éviter le flash
if (localStorage.getItem('sigpes-theme') === 'dark') {
  document.body.classList.add('dark-mode');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
