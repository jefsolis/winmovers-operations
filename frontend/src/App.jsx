import './index.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LanguageProvider } from './i18n'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import JobsList from './pages/Jobs/JobsList'
import JobForm from './pages/Jobs/JobForm'
import ClientsList from './pages/Clients/ClientsList'
import ClientForm from './pages/Clients/ClientForm'
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
import FilesList from './pages/Files/FilesList'
import FileDetail from './pages/Files/FileDetail'
import FileForm from './pages/Files/FileForm'
import SurveyForm from './pages/Surveys/SurveyForm'
import SurveyDetail from './pages/Surveys/SurveyDetail'
import AdminPage from './pages/Admin/AdminPage'

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
          <Route path="files/export"             element={<FilesList category="EXPORT" />} />
          <Route path="files/export/new"         element={<FileForm />} />
          <Route path="files/export/:id"         element={<FileDetail />} />
          <Route path="files/export/:id/edit"    element={<FileForm />} />
          <Route path="files/import"             element={<FilesList category="IMPORT" />} />
          <Route path="files/import/new"         element={<FileForm />} />
          <Route path="files/import/:id"         element={<FileDetail />} />
          <Route path="files/import/:id/edit"    element={<FileForm />} />
          <Route path="files/local"              element={<FilesList category="LOCAL" />} />
          <Route path="files/local/new"          element={<FileForm />} />
          <Route path="files/local/:id"          element={<FileDetail />} />
          <Route path="files/local/:id/edit"     element={<FileForm />} />
          <Route path="surveys/new"              element={<SurveyForm />} />
          <Route path="surveys/:id"              element={<SurveyDetail />} />
          <Route path="surveys/:id/edit"         element={<SurveyForm />} />
          <Route path="admin"                       element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </LanguageProvider>
  )
}
