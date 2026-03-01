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
      dashboard: 'Dashboard', jobs: 'Jobs', clients: 'Clients', contacts: 'Contacts',
      language: 'Español',
    },
    dashboard: {
      title: 'Dashboard', subtitle: 'Operations overview',
      totalJobs: 'Total Jobs', activeJobs: 'Active Jobs',
      totalClients: 'Clients', totalContacts: 'Contacts',
      byStatus: 'Jobs by Status', byType: 'Jobs by Type',
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
      corporateClient: 'Corporate Client', shipperContact: 'Shipper (Contact)',
      originCity: 'Origin City', originCountry: 'Origin Country',
      destCity: 'Destination City', destCountry: 'Destination Country',
      surveyDate: 'Survey Date', packDate: 'Pack Date',
      moveDate_label: 'Move / Load Date', deliveryDate: 'Delivery Date',
      volumeCbm: 'Volume (CBM)', weightKg: 'Weight (KG)',
      createJob: 'Create Job', backToJobs: '← Back to Jobs',
      originPlaceholder: 'e.g. New York', destPlaceholder: 'e.g. London',
    },
    clients: {
      title: 'Clients', subtitle: 'Manage corporate accounts',
      newClient: '+ New Client', newClientTitle: 'New Client', editClient: 'Edit Client',
      companyName: 'Company Name', accountNum: 'Account #', contactInfo: 'Contact Info',
      companyDetails: 'Company Details', accountNumPlaceholder: 'e.g. ACC-0001',
      namePlaceholder: 'e.g. Acme Corporation', addressPlaceholder: 'Street, City, State, ZIP',
      countryPlaceholder: 'e.g. United States', notesPlaceholder: 'Internal notes about this client…',
      backToClients: '← Back to Clients', createClient: 'Create Client',
      empty: 'No clients yet', backSubtitle: 'Corporate account details',
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
      dashboard: 'Panel', jobs: 'Trabajos', clients: 'Clientes', contacts: 'Contactos',
      language: 'English',
    },
    dashboard: {
      title: 'Panel', subtitle: 'Resumen de operaciones',
      totalJobs: 'Total Trabajos', activeJobs: 'Trabajos Activos',
      totalClients: 'Clientes', totalContacts: 'Contactos',
      byStatus: 'Trabajos por Estado', byType: 'Trabajos por Tipo',
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
      corporateClient: 'Cliente Corporativo', shipperContact: 'Embarcador (Contacto)',
      originCity: 'Ciudad Origen', originCountry: 'País Origen',
      destCity: 'Ciudad Destino', destCountry: 'País Destino',
      surveyDate: 'Fecha de Inspección', packDate: 'Fecha de Embalaje',
      moveDate_label: 'Fecha de Mudanza / Carga', deliveryDate: 'Fecha de Entrega',
      volumeCbm: 'Volumen (CBM)', weightKg: 'Peso (KG)',
      createJob: 'Crear Trabajo', backToJobs: '← Volver a Trabajos',
      originPlaceholder: 'ej. Nueva York', destPlaceholder: 'ej. Madrid',
    },
    clients: {
      title: 'Clientes', subtitle: 'Gestionar cuentas corporativas',
      newClient: '+ Nuevo Cliente', newClientTitle: 'Nuevo Cliente', editClient: 'Editar Cliente',
      companyName: 'Nombre de Empresa', accountNum: 'N° de Cuenta', contactInfo: 'Información de Contacto',
      companyDetails: 'Datos de Empresa', accountNumPlaceholder: 'ej. ACC-0001',
      namePlaceholder: 'ej. Acme Corporación', addressPlaceholder: 'Calle, Ciudad, Estado, CP',
      countryPlaceholder: 'ej. Colombia', notesPlaceholder: 'Notas internas sobre este cliente…',
      backToClients: '← Volver a Clientes', createClient: 'Crear Cliente',
      empty: 'Aún no hay clientes', backSubtitle: 'Datos de cuenta corporativa',
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
