// Central registry of all dashboard cards.
// Each card has an id, i18n key paths, and a default visibility.
//
// The `useDashboardLayout` hook reads/writes the hidden-card list.
// Today that list is stored in localStorage; once user auth exists,
// swap the load/save functions in `useDashboardLayout` for API calls.

export const DASHBOARD_CARDS = [
  {
    id: 'kpi',
    titleKey: 'dashboard.store.cards.kpi.title',
    descKey:  'dashboard.store.cards.kpi.desc',
    defaultVisible: true,
  },
  {
    id: 'pipeline',
    titleKey: 'dashboard.store.cards.pipeline.title',
    descKey:  'dashboard.store.cards.pipeline.desc',
    defaultVisible: true,
  },
  {
    id: 'upcoming_visits',
    titleKey: 'dashboard.store.cards.upcomingVisits.title',
    descKey:  'dashboard.store.cards.upcomingVisits.desc',
    defaultVisible: true,
  },
  {
    id: 'pending_quotes',
    titleKey: 'dashboard.store.cards.pendingQuotes.title',
    descKey:  'dashboard.store.cards.pendingQuotes.desc',
    defaultVisible: true,
  },
  {
    id: 'local_no_invoice',
    titleKey: 'dashboard.store.cards.localNoInvoice.title',
    descKey:  'dashboard.store.cards.localNoInvoice.desc',
    defaultVisible: true,
  },
  {
    id: 'delivery_doc_alerts',
    titleKey: 'dashboard.store.cards.deliveryDocAlerts.title',
    descKey:  'dashboard.store.cards.deliveryDocAlerts.desc',
    defaultVisible: true,
  },
  {
    id: 'activity_chart',
    titleKey: 'dashboard.store.cards.activityChart.title',
    descKey:  'dashboard.store.cards.activityChart.desc',
    defaultVisible: true,
  },
  {
    id: 'files_completion',
    titleKey: 'dashboard.store.cards.filesCompletion.title',
    descKey:  'dashboard.store.cards.filesCompletion.desc',
    defaultVisible: true,
  },
  {
    id: 'jobs_by_mode',
    titleKey: 'dashboard.store.cards.jobsByMode.title',
    descKey:  'dashboard.store.cards.jobsByMode.desc',
    defaultVisible: true,
  },
  {
    id: 'jobs_by_type',
    titleKey: 'dashboard.store.cards.jobsByType.title',
    descKey:  'dashboard.store.cards.jobsByType.desc',
    defaultVisible: true,
  },
  {
    id: 'recent_jobs',
    titleKey: 'dashboard.store.cards.recentJobs.title',
    descKey:  'dashboard.store.cards.recentJobs.desc',
    defaultVisible: true,
  },
  // Future cards — require user auth to know "who is the current user"
  {
    id: 'my_coordinations',
    titleKey: 'dashboard.store.cards.myCoordinations.title',
    descKey:  'dashboard.store.cards.myCoordinations.desc',
    defaultVisible: false,
    comingSoon: true,
  },
  {
    id: 'my_appointments',
    titleKey: 'dashboard.store.cards.myAppointments.title',
    descKey:  'dashboard.store.cards.myAppointments.desc',
    defaultVisible: false,
    comingSoon: true,
  },
]
