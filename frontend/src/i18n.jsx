import { createContext, useContext, useState } from 'react'

const translations = {
  en: {
    statuses: {
      SURVEY: 'Survey', QUOTATION: 'Quotation', BOOKING: 'Booking',
      PRE_MOVE: 'Pre-Move', IN_TRANSIT: 'In Transit', DELIVERED: 'Delivered',
      CLOSED: 'Closed', CANCELLED: 'Cancelled',
    },
    types: { INTERNATIONAL: "Int'l", DOMESTIC: 'Domestic' },
    modes: { ROAD: 'Road', SEA: 'Sea', AIR: 'Air', COMBINED: 'Combined' },
    common: {
      save: 'Save Changes', cancel: 'Cancel', search: 'Search', loading: 'Loading…',
      edit: 'Edit', delete: 'Delete', back: 'Back', new: 'New',
      none: '— None —', select: '— Select —', notes: 'Notes',
      noResults: 'No results found.', actions: 'Actions', yes: 'Yes', no: 'No',
      saving: 'Saving…', create: 'Create', name: 'Name', email: 'Email', phone: 'Phone',
      country: 'Country', address: 'Address', optional: 'Optional',
    },
    nav: {
      dashboard: 'Dashboard', jobs: 'Jobs', clients: 'Clients', contacts: 'Contacts', agents: 'Agents',
      language: 'Español',
    },
    dashboard: {
      title: 'Dashboard', subtitle: 'Operations overview',
      totalJobs: 'Total Jobs', activeJobs: 'Active Jobs',
      totalClients: 'Clients', totalContacts: 'Contacts',
      byStatus: 'Jobs by Status', byType: 'Jobs by Type', byMode: 'Jobs by Shipment Mode',
      jobsPerMonth: 'Jobs Created (Last 12 Months)',
      recentJobs: 'Recent Jobs', noJobs: 'No jobs yet.',
      jobNumber: 'Job #', shipper: 'Shipper', route: 'Route', moveDate: 'Move Date',
    },
    jobs: {
      title: 'Jobs', newJob: '+ New Job',
      subtitle_one: '1 job', subtitle_other: '{{n}} jobs',
      jobNumber: 'Job #', shipper: 'Shipper', client: 'Client',
      type: 'Type', status: 'Status', route: 'Route', moveDate: 'Move Date',
      allStatuses: 'All Statuses', allTypes: 'All Types',
      searchPlaceholder: 'Search job #, shipper, client…',
      empty: 'No jobs yet', emptyHint: 'Create your first job to get started.',
      deleteConfirm: 'Delete job {{num}}? This cannot be undone.',
      editJob: 'Edit Job', newJobTitle: 'New Job',
      autoAssigned: 'Job number will be auto-assigned',
      basicInfo: 'Basic Information', parties: 'Parties',
      route_section: 'Route', dates: 'Dates', cargo: 'Cargo',
      jobType: 'Type', jobStatus: 'Status', shipmentMode: 'Shipment Mode',
      corporateClient: 'Client', shipperContact: 'Shipper (Contact)', selectClientFirst: 'Select a client first',
      originAgent: 'Origin Agent', destAgent: 'Destination Agent', customsAgent: 'Customs Broker',
      originCity: 'Origin City', originCountry: 'Origin Country',
      destCity: 'Destination City', destCountry: 'Destination Country',
      callDate: 'Call Date', surveyDate: 'Survey Date & Time', packDate: 'Pack Date',
      moveDate_label: 'Move / Load Date', deliveryDate: 'Delivery Date',
      volumeCbm: 'Volume (CBM)', weightKg: 'Weight (KG)',
      createJob: 'Create Job', backToJobs: '← Back to Jobs',
      originPlaceholder: 'e.g. New York', destPlaceholder: 'e.g. London',
    },
    clients: {
      title: 'Clients', subtitle: 'Manage client accounts',
      newClient: '+ New Client', newClientTitle: 'New Client', editClient: 'Edit Client',
      clientType: 'Client Type', clientTypes: { CORPORATE: 'Corporate', INDIVIDUAL: 'Individual', BROKER: 'Broker / Agent' },
      companyName: 'Company Name', firstName: 'First Name', lastName: 'Last Name',
      accountNum: 'Account #', contactInfo: 'Contact Info',
      companyDetails: 'Client Details', accountNumPlaceholder: 'e.g. ACC-0001',
      namePlaceholder: 'e.g. Acme Corporation', firstNamePlaceholder: 'e.g. John', lastNamePlaceholder: 'e.g. Doe',
      addressPlaceholder: 'Street, City, State, ZIP',
      countryPlaceholder: 'e.g. United States', notesPlaceholder: 'Internal notes about this client…',
      backToClients: '← Back to Clients', createClient: 'Create Client',
      empty: 'No clients yet', backSubtitle: 'Client account details',
      deleteConfirm: 'Delete client "{{name}}"? This cannot be undone.',
      searchPlaceholder: 'Search name, email, country…',
    },
    contacts: {
      title: 'Contacts', subtitle: 'Manage shipper and point-of-contact records',
      newContact: '+ New Contact', newContactTitle: 'New Contact', editContact: 'Edit Contact',
      firstName: 'First Name', lastName: 'Last Name', clientName: 'Client',
      personalDetails: 'Personal Details', association: 'Association',
      corporateClient: 'Corporate Client', independentClient: '— Independent / No Client —',
      firstNamePlaceholder: 'John', lastNamePlaceholder: 'Smith',
      emailPlaceholder: 'john.smith@email.com', phonePlaceholder: '+1 555 000 0000',
      backToContacts: '← Back to Contacts', createContact: 'Create Contact',
      empty: 'No contacts yet', backSubtitle: 'Shipper or point-of-contact record',
      deleteConfirm: 'Delete contact "{{name}}"? This cannot be undone.',
      searchPlaceholder: 'Search name, email…',
    },
    agents: {
      title: 'Agents & Brokers', subtitle: 'Manage origin, destination and customs agents',
      newAgent: '+ New Agent', newAgentTitle: 'New Agent', editAgent: 'Edit Agent',
      agentType: 'Agent Type',
      agentTypes: { ORIGIN: 'Origin Agent', DESTINATION: 'Destination Agent', CUSTOMS: 'Customs Broker', OTHER: 'Other' },
      agentDetails: 'Agent Details', contactInfo: 'Contact Info',
      namePlaceholder: 'e.g. Worldwide Movers Ltd',
      backToAgents: '← Back to Agents', createAgent: 'Create Agent',
      empty: 'No agents yet', backSubtitle: 'Agent or broker record',
      deleteConfirm: 'Delete agent "{{name}}"? This cannot be undone.',
      searchPlaceholder: 'Search name, city, country…',
      jobs: 'Jobs',
    },
    files: {
      title: 'Files', upload: 'Upload File', uploading: 'Uploading…',
      category: 'Document Category', chooseFile: 'Choose file',
      noFiles: 'No files uploaded yet', deleteConfirm: 'Delete "{{name}}"? This cannot be undone.',
      download: 'Download', size: 'Size', uploadedAt: 'Uploaded',
      overview: 'Overview', allCategories: 'All Categories',
      closedBlocked: 'Cannot close job: the following required documents are missing:',
      categories: {
        SURVEY_REPORT: 'Survey Report',
        QUOTATION: 'Quotation',
        INSURANCE_INVENTORY: 'Insurance Inventory',
        SIGNED_QUOTATION: 'Signed Quotation',
        WORK_ORDER: 'Work Order',
        PRE_ADVICE: 'Pre-Advice',
        SHIPPING_INSTRUCTIONS: 'Shipping Instructions',
        TRANSPORT_DOCUMENT: 'Transport Document',
        INSURANCE_CERTIFICATE: 'Insurance Certificate',
        SIGNED_PACKING_LIST: 'Signed Packing List',
        INVOICE: 'Invoice',
        DELIVERY_CONFIRMATION: 'Delivery Confirmation',
        OTHER: 'Other',
      },
    },
  },
  es: {
    statuses: {
      SURVEY: 'Inspección', QUOTATION: 'Cotización', BOOKING: 'Reserva',
      PRE_MOVE: 'Pre-Mudanza', IN_TRANSIT: 'En Tránsito', DELIVERED: 'Entregado',
      CLOSED: 'Cerrado', CANCELLED: 'Cancelado',
    },
    types: { INTERNATIONAL: 'Internacional', DOMESTIC: 'Doméstico' },
    modes: { ROAD: 'Carretera', SEA: 'Marítimo', AIR: 'Aéreo', COMBINED: 'Combinado' },
    common: {
      save: 'Guardar Cambios', cancel: 'Cancelar', search: 'Buscar', loading: 'Cargando…',
      edit: 'Editar', delete: 'Eliminar', back: 'Volver', new: 'Nuevo',
      none: '— Ninguno —', select: '— Seleccionar —', notes: 'Notas',
      noResults: 'Sin resultados.', actions: 'Acciones', yes: 'Sí', no: 'No',
      saving: 'Guardando…', create: 'Crear', name: 'Nombre', email: 'Correo', phone: 'Teléfono',
      country: 'País', address: 'Dirección', optional: 'Opcional',
    },
    nav: {
      dashboard: 'Tablero', jobs: 'Trabajos', clients: 'Clientes', contacts: 'Contactos', agents: 'Agentes',
      language: 'English',
    },
    dashboard: {
      title: 'Tablero', subtitle: 'Resumen de operaciones',
      totalJobs: 'Total Trabajos', activeJobs: 'Trabajos Activos',
      totalClients: 'Clientes', totalContacts: 'Contactos',
      byStatus: 'Trabajos por Estado', byType: 'Trabajos por Tipo', byMode: 'Trabajos por Modo de Envío',
      jobsPerMonth: 'Trabajos Creados (Últimos 12 Meses)',
      recentJobs: 'Trabajos Recientes', noJobs: 'Aún no hay trabajos.',
      jobNumber: 'Trabajo #', shipper: 'Embarcador', route: 'Ruta', moveDate: 'Fecha de Mudanza',
    },
    jobs: {
      title: 'Trabajos', newJob: '+ Nuevo Trabajo',
      subtitle_one: '1 trabajo', subtitle_other: '{{n}} trabajos',
      jobNumber: 'Trabajo #', shipper: 'Embarcador', client: 'Cliente',
      type: 'Tipo', status: 'Estado', route: 'Ruta', moveDate: 'Fecha Mudanza',
      allStatuses: 'Todos los Estados', allTypes: 'Todos los Tipos',
      searchPlaceholder: 'Buscar trabajo #, embarcador, cliente…',
      empty: 'Aún no hay trabajos', emptyHint: 'Crea tu primer trabajo para comenzar.',
      deleteConfirm: '¿Eliminar trabajo {{num}}? Esta acción no se puede deshacer.',
      editJob: 'Editar Trabajo', newJobTitle: 'Nuevo Trabajo',
      autoAssigned: 'El número de trabajo se asignará automáticamente',
      basicInfo: 'Información Básica', parties: 'Partes',
      route_section: 'Ruta', dates: 'Fechas', cargo: 'Carga',
      jobType: 'Tipo', jobStatus: 'Estado', shipmentMode: 'Modo de Envío',
      corporateClient: 'Cliente', shipperContact: 'Embarcador (Contacto)', selectClientFirst: 'Seleccione un cliente primero',
      originAgent: 'Agente Origen', destAgent: 'Agente Destino', customsAgent: 'Agente de Aduanas',
      originCity: 'Ciudad Origen', originCountry: 'País Origen',
      destCity: 'Ciudad Destino', destCountry: 'País Destino',
      callDate: 'Fecha de Llamada', surveyDate: 'Fecha y Hora de Inspección', packDate: 'Fecha de Embalaje',
      moveDate_label: 'Fecha de Mudanza / Carga', deliveryDate: 'Fecha de Entrega',
      volumeCbm: 'Volumen (CBM)', weightKg: 'Peso (KG)',
      createJob: 'Crear Trabajo', backToJobs: '← Volver a Trabajos',
      originPlaceholder: 'ej. Nueva York', destPlaceholder: 'ej. Madrid',
    },
    clients: {
      title: 'Clientes', subtitle: 'Gestionar cuentas de clientes',
      newClient: '+ Nuevo Cliente', newClientTitle: 'Nuevo Cliente', editClient: 'Editar Cliente',
      clientType: 'Tipo de Cliente', clientTypes: { CORPORATE: 'Corporativo', INDIVIDUAL: 'Individual', BROKER: 'Agente / Bróker' },
      companyName: 'Nombre de Empresa', firstName: 'Nombre', lastName: 'Apellido',
      accountNum: 'N° de Cuenta', contactInfo: 'Información de Contacto',
      companyDetails: 'Datos del Cliente', accountNumPlaceholder: 'ej. ACC-0001',
      namePlaceholder: 'ej. Acme Corporación', firstNamePlaceholder: 'ej. Juan', lastNamePlaceholder: 'ej. Pérez',
      addressPlaceholder: 'Calle, Ciudad, Estado, CP',
      countryPlaceholder: 'ej. Colombia', notesPlaceholder: 'Notas internas sobre este cliente…',
      backToClients: '← Volver a Clientes', createClient: 'Crear Cliente',
      empty: 'Aún no hay clientes', backSubtitle: 'Datos de cuenta del cliente',
      deleteConfirm: '¿Eliminar cliente "{{name}}"? Esta acción no se puede deshacer.',
      searchPlaceholder: 'Buscar nombre, correo, país…',
    },
    contacts: {
      title: 'Contactos', subtitle: 'Gestionar embarcadores y puntos de contacto',
      newContact: '+ Nuevo Contacto', newContactTitle: 'Nuevo Contacto', editContact: 'Editar Contacto',
      firstName: 'Nombre', lastName: 'Apellido', clientName: 'Cliente',
      personalDetails: 'Datos Personales', association: 'Asociación',
      corporateClient: 'Cliente Corporativo', independentClient: '— Independiente / Sin Cliente —',
      firstNamePlaceholder: 'Juan', lastNamePlaceholder: 'Pérez',
      emailPlaceholder: 'juan.perez@correo.com', phonePlaceholder: '+57 300 000 0000',
      backToContacts: '← Volver a Contactos', createContact: 'Crear Contacto',
      empty: 'Aún no hay contactos', backSubtitle: 'Registro de embarcador o punto de contacto',
      deleteConfirm: '¿Eliminar contacto "{{name}}"? Esta acción no se puede deshacer.',
      searchPlaceholder: 'Buscar nombre, correo…',
    },
    agents: {
      title: 'Agentes y Brókers', subtitle: 'Gestionar agentes de origen, destino y aduanas',
      newAgent: '+ Nuevo Agente', newAgentTitle: 'Nuevo Agente', editAgent: 'Editar Agente',
      agentType: 'Tipo de Agente',
      agentTypes: { ORIGIN: 'Agente de Origen', DESTINATION: 'Agente de Destino', CUSTOMS: 'Agente de Aduanas', OTHER: 'Otro' },
      agentDetails: 'Datos del Agente', contactInfo: 'Información de Contacto',
      namePlaceholder: 'ej. Worldwide Movers Ltda',
      backToAgents: '← Volver a Agentes', createAgent: 'Crear Agente',
      empty: 'Aún no hay agentes', backSubtitle: 'Registro de agente o bróker',
      deleteConfirm: '¿Eliminar agente "{{name}}"? Esta acción no se puede deshacer.',
      searchPlaceholder: 'Buscar nombre, ciudad, país…',
      jobs: 'Trabajos',
    },
    files: {
      title: 'Archivos', upload: 'Subir Archivo', uploading: 'Subiendo…',
      category: 'Categoría del Documento', chooseFile: 'Seleccionar archivo',
      noFiles: 'Aún no hay archivos', deleteConfirm: '¿Eliminar "{{name}}"? Esta acción no se puede deshacer.',
      download: 'Descargar', size: 'Tamaño', uploadedAt: 'Subido',
      overview: 'Resumen', allCategories: 'Todas las Categorías',
      closedBlocked: 'No se puede cerrar el trabajo: faltan los siguientes documentos requeridos:',
      categories: {
        SURVEY_REPORT: 'Informe de Inspección',
        QUOTATION: 'Cotización',
        INSURANCE_INVENTORY: 'Inventario de Seguro',
        SIGNED_QUOTATION: 'Cotización Firmada',
        WORK_ORDER: 'Orden de Trabajo',
        PRE_ADVICE: 'Pre-Aviso',
        SHIPPING_INSTRUCTIONS: 'Instrucciones de Envío',
        TRANSPORT_DOCUMENT: 'Documento de Transporte',
        INSURANCE_CERTIFICATE: 'Certificado de Seguro',
        SIGNED_PACKING_LIST: 'Lista de Empaque Firmada',
        INVOICE: 'Factura',
        DELIVERY_CONFIRMATION: 'Confirmación de Entrega',
        OTHER: 'Otro',
      },
    },
  },
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('wm-lang') || 'en')

  const toggleLang = () => {
    const next = lang === 'en' ? 'es' : 'en'
    localStorage.setItem('wm-lang', next)
    setLang(next)
  }

  // t('jobs.title') or t('common.save')
  const t = (key, vars = {}) => {
    const parts = key.split('.')
    let val = translations[lang]
    for (const p of parts) {
      val = val?.[p]
      if (val === undefined) return key
    }
    // simple {{var}} substitution
    return String(val).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
