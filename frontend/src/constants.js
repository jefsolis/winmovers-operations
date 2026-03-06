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

const TYPE_VALUES  = ['EXPORT', 'IMPORT', 'INTERNATIONAL', 'DOMESTIC']
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

const CLIENT_TYPE_META = [
  { value: 'CORPORATE', bg: '#dbeafe', color: '#1e40af' },
  { value: 'INDIVIDUAL', bg: '#dcfce7', color: '#166534' },
  { value: 'BROKER',     bg: '#ede9fe', color: '#6d28d9' },
]

export function getClientTypes(t) {
  return CLIENT_TYPE_META.map(c => ({ ...c, label: t(`clients.clientTypes.${c.value}`) }))
}

export function clientTypeMeta(value, t) {
  const meta = CLIENT_TYPE_META.find(c => c.value === value) || { value, bg: '#e2e8f0', color: '#475569' }
  return { ...meta, label: t ? t(`clients.clientTypes.${value}`) : value }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

export const REQUIRED_FILE_CATEGORIES = [
  'SURVEY_REPORT', 'QUOTATION', 'INSURANCE_INVENTORY', 'SIGNED_QUOTATION',
  'WORK_ORDER', 'PRE_ADVICE', 'SHIPPING_INSTRUCTIONS', 'TRANSPORT_DOCUMENT',
  'INSURANCE_CERTIFICATE', 'SIGNED_PACKING_LIST', 'INVOICE', 'DELIVERY_CONFIRMATION'
]

const FILE_CATEGORY_META = [
  { value: 'SURVEY_REPORT',          bg: '#dbeafe', color: '#1e40af' },
  { value: 'QUOTATION',              bg: '#ede9fe', color: '#6d28d9' },
  { value: 'INSURANCE_INVENTORY',    bg: '#fef3c7', color: '#92400e' },
  { value: 'SIGNED_QUOTATION',       bg: '#e0e7ff', color: '#3730a3' },
  { value: 'WORK_ORDER',             bg: '#ccfbf1', color: '#0f766e' },
  { value: 'PRE_ADVICE',             bg: '#fef9c3', color: '#854d0e' },
  { value: 'SHIPPING_INSTRUCTIONS',  bg: '#e0f2fe', color: '#0369a1' },
  { value: 'TRANSPORT_DOCUMENT',     bg: '#bfdbfe', color: '#1d4ed8' },
  { value: 'INSURANCE_CERTIFICATE',  bg: '#ffedd5', color: '#c2410c' },
  { value: 'SIGNED_PACKING_LIST',    bg: '#dcfce7', color: '#16a34a' },
  { value: 'INVOICE',                bg: '#fee2e2', color: '#b91c1c' },
  { value: 'DELIVERY_CONFIRMATION',  bg: '#d1fae5', color: '#065f46' },
  { value: 'OTHER',                  bg: '#e2e8f0', color: '#475569' },
]

export function getFileCategories(t) {
  return FILE_CATEGORY_META.map(c => ({ ...c, label: t(`files.categories.${c.value}`) }))
}

export function fileCategoryMeta(value, t) {
  const meta = FILE_CATEGORY_META.find(c => c.value === value) || { value, bg: '#e2e8f0', color: '#475569' }
  return { ...meta, label: t ? t(`files.categories.${value}`) : value }
}

export function formatFileSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Moving File (Expediente) ─────────────────────────────────────────────────
export const FILE_CATEGORIES = ['EXPORT', 'IMPORT', 'LOCAL']

export const REQUIRED_ATTACHMENTS = {
  EXPORT: ['SURVEY_REPORT', 'QUOTATION', 'INSURANCE_INVENTORY', 'SIGNED_QUOTATION',
           'WORK_ORDER', 'PRE_ADVICE', 'SHIPPING_INSTRUCTIONS', 'TRANSPORT_DOCUMENT',
           'INSURANCE_CERTIFICATE', 'SIGNED_PACKING_LIST', 'INVOICE', 'DELIVERY_CONFIRMATION'],
  IMPORT: ['QUOTATION', 'INSURANCE_INVENTORY', 'SIGNED_QUOTATION', 'WORK_ORDER',
           'SHIPPING_INSTRUCTIONS', 'TRANSPORT_DOCUMENT', 'INSURANCE_CERTIFICATE',
           'SIGNED_PACKING_LIST', 'INVOICE', 'DELIVERY_CONFIRMATION'],
  LOCAL:  ['INVOICE'],
}

const FILE_STATUS_META = [
  { value: 'OPEN',   bg: '#dbeafe', color: '#1e40af' },
  { value: 'CLOSED', bg: '#d1fae5', color: '#065f46' },
]

export function getFileStatuses(t) {
  return FILE_STATUS_META.map(s => ({ ...s, label: t(`fileStatuses.${s.value}`) }))
}

export function fileStatusMeta(value, t) {
  const meta = FILE_STATUS_META.find(s => s.value === value) || { value, bg: '#e2e8f0', color: '#475569' }
  return { ...meta, label: t ? t(`fileStatuses.${value}`) : value }
}

export function getFileCategoryLabel(category, t) {
  return t ? t(`fileCategories.${category}`) : category
}

// ── Visit ────────────────────────────────────────────────────────────────────
const VISIT_STATUS_META = [
  { value: 'SCHEDULED',  bg: '#dbeafe', color: '#1e40af' },
  { value: 'COMPLETED',  bg: '#ede9fe', color: '#6d28d9' },
  { value: 'QUOTED',     bg: '#fef3c7', color: '#92400e' },
  { value: 'CLOSED',     bg: '#e2e8f0', color: '#475569' },
]

export function getVisitStatuses(t) {
  return VISIT_STATUS_META.map(s => ({ ...s, label: t(`visitStatuses.${s.value}`) }))
}

export function visitStatusMeta(value, t) {
  const meta = VISIT_STATUS_META.find(s => s.value === value) || { value, bg: '#e2e8f0', color: '#475569' }
  return { ...meta, label: t ? t(`visitStatuses.${value}`) : value }
}

const SERVICE_TYPE_META = [
  { value: 'DOOR_TO_PORT' },
  { value: 'DOOR_TO_DOOR' },
  { value: 'PACKING' },
  { value: 'LOCAL_MOVE' },
]

export function getServiceTypes(t) {
  return SERVICE_TYPE_META.map(s => ({ ...s, label: t(`serviceTypes.${s.value}`) }))
}

// ── Quote ────────────────────────────────────────────────────────────────────
const QUOTE_STATUS_META = [
  { value: 'DRAFT',     bg: '#e2e8f0', color: '#475569' },
  { value: 'SENT',      bg: '#dbeafe', color: '#1e40af' },
  { value: 'ACCEPTED',  bg: '#dcfce7', color: '#166534' },
  { value: 'REJECTED',  bg: '#fee2e2', color: '#991b1b' },
]

export function getQuoteStatuses(t) {
  return QUOTE_STATUS_META.map(s => ({ ...s, label: t(`quoteStatuses.${s.value}`) }))
}

export function quoteStatusMeta(value, t) {
  const meta = QUOTE_STATUS_META.find(s => s.value === value) || { value, bg: '#e2e8f0', color: '#475569' }
  return { ...meta, label: t ? t(`quoteStatuses.${value}`) : value }
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CRC', 'COP', 'MXN', 'PEN', 'CLP', 'ARS']
