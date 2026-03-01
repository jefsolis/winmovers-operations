export const JOB_STATUSES = [
  { value: 'SURVEY',     label: 'Survey',     bg: '#e2e8f0', color: '#475569' },
  { value: 'QUOTATION',  label: 'Quotation',  bg: '#dbeafe', color: '#1e40af' },
  { value: 'BOOKING',    label: 'Booking',    bg: '#ede9fe', color: '#6d28d9' },
  { value: 'PRE_MOVE',   label: 'Pre-Move',   bg: '#fef3c7', color: '#92400e' },
  { value: 'IN_TRANSIT', label: 'In Transit', bg: '#fef9c3', color: '#854d0e' },
  { value: 'DELIVERED',  label: 'Delivered',  bg: '#dcfce7', color: '#166534' },
  { value: 'CLOSED',     label: 'Closed',     bg: '#d1fae5', color: '#065f46' },
  { value: 'CANCELLED',  label: 'Cancelled',  bg: '#fee2e2', color: '#991b1b' }
]

export const JOB_TYPES = [
  { value: 'INTERNATIONAL', label: "Int'l" },
  { value: 'DOMESTIC',      label: 'Domestic' }
]

export const SHIPMENT_MODES = [
  { value: 'ROAD',     label: 'Road' },
  { value: 'SEA',      label: 'Sea' },
  { value: 'AIR',      label: 'Air' },
  { value: 'COMBINED', label: 'Combined' }
]

export function statusMeta(value) {
  return JOB_STATUSES.find(s => s.value === value) || { label: value, bg: '#e2e8f0', color: '#475569' }
}

export function typeMeta(value) {
  return JOB_TYPES.find(t => t.value === value) || { label: value }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
