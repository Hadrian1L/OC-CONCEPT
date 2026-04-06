import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import SignUp from './pages/SignUp'
import Admin from './pages/Admin'
import Results from './pages/Results'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<SignUp />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
)