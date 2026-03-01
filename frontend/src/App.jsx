import './index.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import JobsList from './pages/Jobs/JobsList'
import JobForm from './pages/Jobs/JobForm'
import ClientsList from './pages/Clients/ClientsList'
import ClientForm from './pages/Clients/ClientForm'
import ContactsList from './pages/Contacts/ContactsList'
import ContactForm from './pages/Contacts/ContactForm'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"          element={<Dashboard />} />
          <Route path="jobs"               element={<JobsList />} />
          <Route path="jobs/new"           element={<JobForm />} />
          <Route path="jobs/:id/edit"      element={<JobForm />} />
          <Route path="clients"            element={<ClientsList />} />
          <Route path="clients/new"        element={<ClientForm />} />
          <Route path="clients/:id/edit"   element={<ClientForm />} />
          <Route path="contacts"           element={<ContactsList />} />
          <Route path="contacts/new"       element={<ContactForm />} />
          <Route path="contacts/:id/edit"  element={<ContactForm />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
