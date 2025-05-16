import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import App from './App'
import Login from './components/Login'
import AdminDashboard from './components/AdminDashboard'
import Feedback from './components/Feedback';
import { UserAuthContextProvider } from './context/UserAuthContext'
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import MergedRouteEditor from './components/MergedRouteEditor'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UserAuthContextProvider>
      <Router>
        <Routes>
          <Route path="*" element={<App />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/editroutes" element={<MergedRouteEditor />} />
        </Routes>
      </Router>
    </UserAuthContextProvider>
  </React.StrictMode>
)