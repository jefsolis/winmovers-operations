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
const MODE_VALUES  = ['ROAD', 'SEA', 'AIR']

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
]

export function getClientTypes(t) {
  return CLIENT_TYPE_META.map(c => ({ ...c, label: t(`clients.clientTypes.${c.value}`) }))
}

export function clientTypeMeta(value, t) {
  const meta = CLIENT_TYPE_META.find(c => c.value === value) || { value, bg: '#e2e8f0', color: '#475569' }
  return { ...meta, label: t ? t(`clients.clientTypes.${value}`) : value }
}

export function stripFilePrefix(num) {
  return num ? num.replace(/^[A-Z]+-/, '') : num
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })
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
  { value: 'TARIFF_REPLY_EMAIL',     bg: '#ede9fe', color: '#5b21b6' },
  { value: 'CONSIGNMENT_EMAIL',      bg: '#dcfce7', color: '#15803d' },
  { value: 'DELIVERY_DOCS_EMAIL',    bg: '#fff7ed', color: '#c2410c' },
  { value: 'DELIVERY_INFO_EMAIL',    bg: '#ccfbf1', color: '#0f766e' },
  { value: 'DELIVERY_REPORT',        bg: '#fce7f3', color: '#be185d' },
  { value: 'TARIFF_CONTESTATION',    bg: '#fef3c7', color: '#b45309' },
  { value: 'PRE_ADVICE_EMAIL',        bg: '#fde68a', color: '#92400e' },
  { value: 'WAYBILL_EMAIL',           bg: '#e9d5ff', color: '#6b21a8' },
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
  EXPORT: ['SURVEY_REPORT', 'QUOTATION', 'WORK_ORDER', 'PRE_ADVICE',
           'PRE_ADVICE_EMAIL', 'WAYBILL_EMAIL',
           'SHIPPING_INSTRUCTIONS', 'TRANSPORT_DOCUMENT',
           'SIGNED_PACKING_LIST', 'INVOICE', 'DELIVERY_CONFIRMATION'],
  IMPORT: ['QUOTATION', 'WORK_ORDER', 'SHIPPING_INSTRUCTIONS', 'TRANSPORT_DOCUMENT', 'INVOICE',
           'TARIFF_REPLY_EMAIL', 'DELIVERY_DOCS_EMAIL', 'DELIVERY_INFO_EMAIL', 'DELIVERY_REPORT'],
  LOCAL:  ['INVOICE'],
}

export const OPTIONAL_ATTACHMENTS = {
  EXPORT: ['INSURANCE_INVENTORY', 'INSURANCE_CERTIFICATE', 'SIGNED_QUOTATION', 'TARIFF_CONTESTATION'],
  IMPORT: ['INSURANCE_INVENTORY', 'INSURANCE_CERTIFICATE', 'SIGNED_QUOTATION', 'CONSIGNMENT_EMAIL'],
  LOCAL:  [],
}

export const ATTACHMENT_DUE_OFFSETS = {
  DELIVERY_DOCS_EMAIL: { days: 3 },
}

const FILE_STATUS_META = [
  { value: 'OPEN',                  bg: '#dbeafe', color: '#1e40af' },
  { value: 'PACKING',               bg: '#fef3c7', color: '#92400e' },
  { value: 'WAITING_GREEN_LIGHT',   bg: '#fef9c3', color: '#713f12' },
  { value: 'DISPATCH',              bg: '#e0f2fe', color: '#0c4a6e' },
  { value: 'TRANSIT',               bg: '#ede9fe', color: '#4c1d95' },
  { value: 'WAITING_DELIVERY_DOCS', bg: '#fff7ed', color: '#9a3412' },
  { value: 'CUSTOMS',               bg: '#fae8ff', color: '#701a75' },
  { value: 'CLOSED',                bg: '#d1fae5', color: '#065f46' },
  { value: 'VOID',                  bg: '#fee2e2', color: '#991b1b' },
]

const EXPORT_FILE_PROGRESSION = ['OPEN', 'PACKING', 'WAITING_GREEN_LIGHT', 'DISPATCH', 'TRANSIT', 'WAITING_DELIVERY_DOCS']
const IMPORT_FILE_PROGRESSION = ['OPEN', 'PACKING', 'DISPATCH', 'TRANSIT', 'CUSTOMS']

export function getFileStatuses(t) {
  return FILE_STATUS_META.map(s => ({ ...s, label: t(`fileStatuses.${s.value}`) }))
}

export function fileStatusMeta(value, t) {
  const meta = FILE_STATUS_META.find(s => s.value === value) || { value, bg: '#e2e8f0', color: '#475569' }
  return { ...meta, label: t ? t(`fileStatuses.${value}`) : value }
}

export function getFileProgressionStatuses(category, t) {
  const values = category === 'EXPORT' ? EXPORT_FILE_PROGRESSION
    : category === 'IMPORT' ? IMPORT_FILE_PROGRESSION
    : ['OPEN']
  return values.map(v => ({ value: v, ...fileStatusMeta(v, t) }))
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
  { value: 'LOCAL_MOVE' },
]

export function getServiceTypes(t) {
  return SERVICE_TYPE_META.map(s => ({ ...s, label: t(`serviceTypes.${s.value}`) }))
}

// File service types (IMPORT/EXPORT/LOCAL files)
const FILE_SERVICE_TYPE_META = [
  { value: 'DOOR_TO_PORT' },
  { value: 'DOOR_TO_DOOR' },
  { value: 'PORT_TO_DOOR' },
]

export function getFileServiceTypes(t) {
  return FILE_SERVICE_TYPE_META.map(s => ({ ...s, label: t(`serviceTypes.${s.value}`) }))
}

// Booker role options (differ per context)
const VISIT_BOOKER_ROLES = ['BOOKER', 'OA', 'DA']
const FILE_BOOKER_ROLES  = ['BOOKER', 'OA', 'DA']

export function getVisitBookerRoles() { return VISIT_BOOKER_ROLES }
export function getFileBookerRoles()  { return FILE_BOOKER_ROLES  }

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

// ── Survey Cubic Feet ────────────────────────────────────────────────────────
// Pre-defined article lists per room with standard CF values.
// Users enter "No. of Pieces"; Total CF = Qty × CF per item.
export const SURVEY_ROOM_ITEMS = {
  LIVING_ROOM: [
    { description: 'Bookcase-small',       cfPerItem: 10 },
    { description: 'Bookcase-large',       cfPerItem: 25 },
    { description: 'CD rack',              cfPerItem: 4  },
    { description: 'Computer table',       cfPerItem: 15 },
    { description: 'Corner Cabinet',       cfPerItem: 20 },
    { description: 'Chair',                cfPerItem: 8  },
    { description: 'Chair-Overstuffed',    cfPerItem: 25 },
    { description: 'Chair-Rocker',         cfPerItem: 15 },
    { description: 'Desk-Winthrop',        cfPerItem: 12 },
    { description: 'Desk-Secretary',       cfPerItem: 20 },
    { description: 'Entertainment center', cfPerItem: 60 },
    { description: 'Fireplace tools',      cfPerItem: 5  },
    { description: 'Foot stool',           cfPerItem: 2  },
    { description: 'Grandfather clock',    cfPerItem: 15 },
    { description: 'Lamp floor',           cfPerItem: 2  },
    { description: 'Lamp table',           cfPerItem: 2  },
    { description: 'Magazine rack',        cfPerItem: 2  },
    { description: 'Ottoman',              cfPerItem: 20 },
    { description: 'Piano upright',        cfPerItem: 45 },
    { description: 'Piano grand',          cfPerItem: 65 },
    { description: 'Piano bench',          cfPerItem: 7  },
    { description: 'Sofa love seat',       cfPerItem: 35 },
    { description: 'Sofa large',           cfPerItem: 45 },
    { description: 'Sofa bed',             cfPerItem: 40 },
    { description: 'Stool',                cfPerItem: 3  },
    { description: 'Table end',            cfPerItem: 5  },
    { description: 'Table coffee',         cfPerItem: 10 },
    { description: 'Table sofa',           cfPerItem: 12 },
    { description: 'Table occasional',     cfPerItem: 15 },
    { description: 'TV cabinet',           cfPerItem: 20 },
    { description: 'TV large',             cfPerItem: 15 },
    { description: 'TV big screen',        cfPerItem: 40 },
    { description: 'Mirror -crate-',       cfPerItem: 12 },
  ],
  DINING_ROOM: [
    { description: 'Bench',          cfPerItem: 15 },
    { description: 'Buffet',         cfPerItem: 30 },
    { description: 'Chair',          cfPerItem: 5  },
    { description: 'Chairs closet',  cfPerItem: 30 },
    { description: 'Server',         cfPerItem: 15 },
    { description: 'Table',          cfPerItem: 40 },
    { description: 'Tea cart',       cfPerItem: 5  },
    { description: 'Wine rack',      cfPerItem: 10 },
  ],
  KITCHEN: [
    { description: 'Chair high',      cfPerItem: 3  },
    { description: 'Chair',           cfPerItem: 6  },
    { description: 'Kitchen table',   cfPerItem: 15 },
    { description: 'Microwave table', cfPerItem: 8  },
    { description: 'Stool',           cfPerItem: 3  },
  ],
  MASTER_BEDROOM: [
    { description: 'Bed single',             cfPerItem: 30 },
    { description: 'Bed double',             cfPerItem: 35 },
    { description: 'Bed king/queen',         cfPerItem: 60 },
    { description: 'Bed rails/head/foot',    cfPerItem: 7  },
    { description: 'Chest',                  cfPerItem: 10 },
    { description: 'Clothes basket',         cfPerItem: 4  },
    { description: 'Chest of drawers',       cfPerItem: 25 },
    { description: 'Dresser bench',          cfPerItem: 5  },
    { description: 'Dresser single',         cfPerItem: 35 },
    { description: 'Dresser double',         cfPerItem: 40 },
    { description: 'Dresser triple',         cfPerItem: 50 },
    { description: 'Lamps bedside',          cfPerItem: 2  },
    { description: 'Entertainment center',   cfPerItem: 60 },
    { description: 'Night stand w/ drawer',  cfPerItem: 4  },
    { description: 'Night table',            cfPerItem: 5  },
    { description: 'Wardrobe',               cfPerItem: 45 },
    { description: 'Waterbed frame',         cfPerItem: 30 },
  ],
  CHILD_BEDROOM: [
    { description: 'Bunk bed',        cfPerItem: 15 },
    { description: 'Chair',           cfPerItem: 8  },
    { description: 'Chest',           cfPerItem: 10 },
    { description: 'Crib Mattress',   cfPerItem: 4  },
    { description: 'Crib/Slides/Frame', cfPerItem: 10 },
    { description: 'Desk',            cfPerItem: 10 },
    { description: 'Desk chair',      cfPerItem: 4  },
    { description: 'Play pen',        cfPerItem: 3  },
    { description: 'Stroller',        cfPerItem: 2  },
    { description: 'Table childs',    cfPerItem: 3  },
    { description: 'Table changing',  cfPerItem: 10 },
    { description: 'Toy chest',       cfPerItem: 5  },
    { description: 'Toys',            cfPerItem: 3  },
  ],
  SPORTS_EQUIPMENT: [
    { description: 'Bicycle',         cfPerItem: 12 },
    { description: 'Camping items',   cfPerItem: 3  },
    { description: 'Cooler',          cfPerItem: 3  },
    { description: 'Exercise items',  cfPerItem: 20 },
    { description: 'Golf bag / Clubs',cfPerItem: 3  },
    { description: 'Ping Pong table', cfPerItem: 15 },
    { description: 'Ski equipment',   cfPerItem: 3  },
  ],
  APPLIANCES: [
    { description: 'Dishwasher',          cfPerItem: 13 },
    { description: 'Washer',              cfPerItem: 15 },
    { description: 'Dryer',               cfPerItem: 15 },
    { description: 'Freezer',             cfPerItem: 45 },
    { description: 'Refrigerator',        cfPerItem: 40 },
    { description: 'Refrigerator double', cfPerItem: 65 },
  ],
  MIS_OTHER: [
    { description: 'Caja fuerte',      cfPerItem: 10 },
    { description: 'Folding screen',   cfPerItem: 4  },
    { description: 'Lampara de techo', cfPerItem: 5  },
    { description: 'Misc',             cfPerItem: 3  },
    { description: 'Painting',         cfPerItem: 10 },
    { description: 'Tendedero',        cfPerItem: 1  },
  ],
  PATIO: [
    { description: 'BBQ Grill',    cfPerItem: 15 },
    { description: 'Hose',         cfPerItem: 2  },
    { description: 'Jungle gym',   cfPerItem: 35 },
    { description: 'Sun lounger',  cfPerItem: 4  },
    { description: 'Table patio',  cfPerItem: 20 },
    { description: 'Table picnic', cfPerItem: 15 },
    { description: 'Umbrella',     cfPerItem: 3  },
    { description: 'Umb. Base',    cfPerItem: 2  },
  ],
  MISC: [
    { description: 'Artificial plant', cfPerItem: 5  },
    { description: 'Cabinet 2 drw',   cfPerItem: 7  },
    { description: 'Cabinet 4 drw',   cfPerItem: 15 },
    { description: 'Desk',             cfPerItem: 30 },
    { description: 'Folding chair',    cfPerItem: 1  },
    { description: 'Hall tree',        cfPerItem: 3  },
    { description: 'Hall tree rack',   cfPerItem: 10 },
    { description: 'Hamper',           cfPerItem: 3  },
    { description: 'Ironing board',    cfPerItem: 2  },
    { description: 'Rug large',        cfPerItem: 10 },
    { description: 'Rug small',        cfPerItem: 5  },
    { description: 'Table card',       cfPerItem: 2  },
    { description: 'Trunk',            cfPerItem: 10 },
    { description: 'Vacuum cleaner',   cfPerItem: 3  },
  ],
  GARAGE: [
    { description: 'Child Tricycle',    cfPerItem: 4  },
    { description: 'Christmas items',   cfPerItem: 4  },
    { description: 'Garden tools',      cfPerItem: 10 },
    { description: 'Ladder ext',        cfPerItem: 15 },
    { description: 'Ladder step',       cfPerItem: 3  },
    { description: 'Lawn Mower',        cfPerItem: 10 },
    { description: 'Lawn spreader',     cfPerItem: 2  },
    { description: 'Luggage',           cfPerItem: 5  },
    { description: 'Power edger',       cfPerItem: 5  },
    { description: 'Shelves',           cfPerItem: 2  },
    { description: 'Tool chest large',  cfPerItem: 8  },
    { description: 'Tool chest small',  cfPerItem: 2  },
    { description: 'Trash can',         cfPerItem: 10 },
    { description: 'Work bench',        cfPerItem: 15 },
    { description: 'Misc',              cfPerItem: 20 },
  ],
}

export const SURVEY_CARTON_ITEMS = [
  { description: 'Dish pack',         cfPerItem: 3   },
  { description: 'Carton 1.5',        cfPerItem: 1.5 },
  { description: 'Carton 3.0',        cfPerItem: 3   },
  { description: 'Carton 4.5',        cfPerItem: 4.5 },
  { description: 'Wardrobe flat',     cfPerItem: 8   },
  { description: 'Wardrobe upright',  cfPerItem: 12  },
  { description: 'Mirror ctn. Small', cfPerItem: 4   },
  { description: 'Mirror ctn. Large', cfPerItem: 8   },
]

// For column-total display in SurveyDetail
export const SURVEY_COLUMN_ROOMS = [
  ['LIVING_ROOM'],
  ['DINING_ROOM', 'KITCHEN', 'MASTER_BEDROOM'],
  ['CHILD_BEDROOM', 'SPORTS_EQUIPMENT', 'APPLIANCES', 'MIS_OTHER'],
  ['PATIO', 'MISC', 'GARAGE'],
]
