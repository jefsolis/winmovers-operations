import './index.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LanguageProvider } from './i18n'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import JobsList from './pages/Jobs/JobsList'
import JobForm from './pages/Jobs/JobForm'
import ClientsList from './pages/Clients/ClientsList'
import ClientForm from './pages/Clients/ClientForm'
import ContactsList from './pages/Contacts/ContactsList'
import ContactForm from './pages/Contacts/ContactForm'
import AgentsList from './pages/Agents/AgentsList'
import AgentForm from './pages/Agents/AgentForm'
import JobDetail from './pages/Jobs/JobDetail'
import VisitsList from './pages/Visits/VisitsList'
import VisitForm from './pages/Visits/VisitForm'
import VisitDetail from './pages/Visits/VisitDetail'
import QuotesList from './pages/Quotes/QuotesList'
import QuoteForm from './pages/Quotes/QuoteForm'
import QuoteDetail from './pages/Quotes/QuoteDetail'
import StaffList from './pages/Staff/StaffList'
import StaffForm from './pages/Staff/StaffForm'

export default function App() {
  return (
    <LanguageProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"          element={<Dashboard />} />
          <Route path="jobs"               element={<JobsList />} />
          <Route path="jobs/new"           element={<JobForm />} />
          <Route path="jobs/:id"           element={<JobDetail />} />
          <Route path="jobs/:id/edit"      element={<JobForm />} />
          <Route path="clients"            element={<ClientsList />} />
          <Route path="clients/new"        element={<ClientForm />} />
          <Route path="clients/:id/edit"   element={<ClientForm />} />
          <Route path="contacts"            element={<ContactsList />} />
          <Route path="contacts/new"        element={<ContactForm />} />
          <Route path="contacts/:id/edit"  element={<ContactForm />} />
          <Route path="agents"              element={<AgentsList />} />
          <Route path="agents/new"          element={<AgentForm />} />
          <Route path="agents/:id/edit"     element={<AgentForm />} />
          <Route path="visits"              element={<VisitsList />} />
          <Route path="visits/new"          element={<VisitForm />} />
          <Route path="visits/:id"          element={<VisitDetail />} />
          <Route path="visits/:id/edit"     element={<VisitForm />} />
          <Route path="quotes"              element={<QuotesList />} />
          <Route path="quotes/new"          element={<QuoteForm />} />
          <Route path="quotes/:id"          element={<QuoteDetail />} />
          <Route path="quotes/:id/edit"     element={<QuoteForm />} />
          <Route path="staff"               element={<StaffList />} />
          <Route path="staff/new"           element={<StaffForm />} />
          <Route path="staff/:id/edit"      element={<StaffForm />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </LanguageProvider>
  )
}
