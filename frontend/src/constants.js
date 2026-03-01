// Colour/style metadata — labels come from i18n via t()
const STATUS_META = [
  { value: 'SURVEY',     bg: '#e2e8f0', color: '#475569' },
  { value: 'QUOTATION',  bg: '#dbeafe', color: '#1e40af' },
  { value: 'BOOKING',    bg: '#ede9fe', color: '#6d28d9' },
  { value: 'PRE_MOVE',   bg: '#fef3c7', color: '#92400e' },
  { value: 'IN_TRANSIT', bg: '#fef9c3', color: '#854d0e' },
  { value: 'DELIVERED',  bg: '#dcfce7', color: '#166534' },
  { value: 'CLOSED',     bg: '#d1fae5', color: '#065f46' },
  { value: 'CANCELLED',  bg: '#fee2e2', color: '#991b1b' },
]

const TYPE_VALUES  = ['INTERNATIONAL', 'DOMESTIC']
const MODE_VALUES  = ['ROAD', 'SEA', 'AIR', 'COMBINED']

// Pass the t() function from useLanguage() to get translated labels
export function getJobStatuses(t) {
  return STATUS_META.map(s => ({ ...s, label: t(`statuses.${s.value}`) }))
}

export function getJobTypes(t) {
  return TYPE_VALUES.map(v => ({ value: v, label: t(`types.${v}`) }))
}

export function getShipmentModes(t) {
  return MODE_VALUES.map(v => ({ value: v, label: t(`modes.${v}`) }))
}

export function statusMeta(value, t) {
  const meta = STATUS_META.find(s => s.value === value) || { value, bg: '#e2e8f0', color: '#475569' }
  return { ...meta, label: t ? t(`statuses.${value}`) : value }
}

export function typeMeta(value, t) {
  return { value, label: t ? t(`types.${value}`) : value }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
