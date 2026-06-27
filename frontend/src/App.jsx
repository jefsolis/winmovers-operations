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
import MyProfilePage from './pages/Profile/MyProfilePage'
import FilesList from './pages/Files/FilesList'
import FileDetail from './pages/Files/FileDetail'
import FileForm from './pages/Files/FileForm'
import SurveyForm from './pages/Surveys/SurveyForm'
import SurveyDetail from './pages/Surveys/SurveyDetail'
import AdminPage from './pages/Admin/AdminPage'
import AuditLogPage from './pages/Admin/AuditLogPage'
import SchedulePage from './pages/Schedule/SchedulePage'
import FidiReport from './pages/Reports/FidiReport'
import RequireAdmin from './auth/RequireAdmin'
import RequireScheduleAccess from './auth/RequireScheduleAccess'
import RequireJobWriteAccess from './auth/RequireJobWriteAccess'
import RequireNonBodega, { HomeRedirect } from './auth/RequireBodegaAccess'
import ReloadBanner from './components/ReloadBanner'

export default function App() {
  return (
    <LanguageProvider>
    <BrowserRouter>
      <ReloadBanner />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard"          element={<RequireNonBodega><Dashboard /></RequireNonBodega>} />
          <Route path="jobs"               element={<JobsList />} />
          <Route path="jobs/new"           element={<RequireJobWriteAccess><JobForm /></RequireJobWriteAccess>} />
          <Route path="jobs/:id"           element={<JobDetail />} />
          <Route path="jobs/:id/edit"      element={<RequireJobWriteAccess><JobForm /></RequireJobWriteAccess>} />
          <Route path="clients"            element={<RequireNonBodega><ClientsList /></RequireNonBodega>} />
          <Route path="clients/new"        element={<RequireNonBodega><ClientForm /></RequireNonBodega>} />
          <Route path="clients/:id/edit"   element={<RequireNonBodega><ClientForm /></RequireNonBodega>} />
          <Route path="agents"              element={<RequireNonBodega><AgentsList /></RequireNonBodega>} />
          <Route path="agents/new"          element={<RequireNonBodega><AgentForm /></RequireNonBodega>} />
          <Route path="agents/:id/edit"     element={<RequireNonBodega><AgentForm /></RequireNonBodega>} />
          <Route path="visits"              element={<RequireNonBodega><VisitsList /></RequireNonBodega>} />
          <Route path="visits/new"          element={<RequireNonBodega><VisitForm /></RequireNonBodega>} />
          <Route path="visits/:id"          element={<RequireNonBodega><VisitDetail /></RequireNonBodega>} />
          <Route path="visits/:id/edit"     element={<RequireNonBodega><VisitForm /></RequireNonBodega>} />
          <Route path="quotes"              element={<RequireNonBodega><QuotesList /></RequireNonBodega>} />
          <Route path="quotes/new"          element={<RequireNonBodega><QuoteForm /></RequireNonBodega>} />
          <Route path="quotes/:id"          element={<RequireNonBodega><QuoteDetail /></RequireNonBodega>} />
          <Route path="quotes/:id/edit"     element={<RequireNonBodega><QuoteForm /></RequireNonBodega>} />
          <Route path="staff"               element={<RequireNonBodega><StaffList /></RequireNonBodega>} />
          <Route path="staff/new"           element={<RequireNonBodega><StaffForm /></RequireNonBodega>} />
          <Route path="staff/:id/edit"      element={<RequireNonBodega><StaffForm /></RequireNonBodega>} />
          <Route path="profile"             element={<RequireNonBodega><MyProfilePage /></RequireNonBodega>} />
          <Route path="files/export"             element={<RequireNonBodega><FilesList category="EXPORT" /></RequireNonBodega>} />
          <Route path="files/export/new"         element={<RequireNonBodega><FileForm /></RequireNonBodega>} />
          <Route path="files/export/:id"         element={<RequireNonBodega><FileDetail /></RequireNonBodega>} />
          <Route path="files/export/:id/edit"    element={<RequireNonBodega><FileForm /></RequireNonBodega>} />
          <Route path="files/import"             element={<RequireNonBodega><FilesList category="IMPORT" /></RequireNonBodega>} />
          <Route path="files/import/new"         element={<RequireNonBodega><FileForm /></RequireNonBodega>} />
          <Route path="files/import/:id"         element={<RequireNonBodega><FileDetail /></RequireNonBodega>} />
          <Route path="files/import/:id/edit"    element={<RequireNonBodega><FileForm /></RequireNonBodega>} />
          <Route path="files/local"              element={<RequireNonBodega><FilesList category="LOCAL" /></RequireNonBodega>} />
          <Route path="files/local/new"          element={<RequireNonBodega><FileForm /></RequireNonBodega>} />
          <Route path="files/local/:id"          element={<RequireNonBodega><FileDetail /></RequireNonBodega>} />
          <Route path="files/local/:id/edit"     element={<RequireNonBodega><FileForm /></RequireNonBodega>} />
          <Route path="surveys/new"              element={<RequireNonBodega><SurveyForm /></RequireNonBodega>} />
          <Route path="surveys/:id"              element={<RequireNonBodega><SurveyDetail /></RequireNonBodega>} />
          <Route path="surveys/:id/edit"         element={<RequireNonBodega><SurveyForm /></RequireNonBodega>} />
          <Route path="admin" element={<RequireNonBodega><RequireAdmin><AdminPage /></RequireAdmin></RequireNonBodega>} />
          <Route path="admin/audit" element={<RequireNonBodega><RequireAdmin><AuditLogPage /></RequireAdmin></RequireNonBodega>} />
          <Route path="reports/fidi" element={<RequireNonBodega><RequireAdmin><FidiReport /></RequireAdmin></RequireNonBodega>} />
          <Route path="schedule" element={<RequireScheduleAccess><SchedulePage /></RequireScheduleAccess>} />
        </Route>
      </Routes>
    </BrowserRouter>
    </LanguageProvider>
  )
}
