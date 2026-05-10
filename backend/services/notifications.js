/**
 * Notification helpers — called fire-and-forget from route handlers.
 * All functions catch their own errors so a mail failure never breaks the API response.
 */
const { sendMail } = require('./graph')
const { getPrisma } = require('../db')

/**
 * Persist an email delivery attempt to the EmailLog table.
 * Never throws — a DB failure here must not affect the calling function.
 */
async function logEmail(entityType, entityId, recipient, subject, status, error) {
  try {
    await getPrisma().emailLog.create({
      data: { entityType, entityId, recipient, subject, status, error: error || null },
    })
  } catch (e) {
    console.error('[notify] logEmail DB error:', e.message)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Costa_Rica',
  })
}

function formatDateShort(d) {
  if (!d) return '—'
  return new Date(d).toISOString().slice(0, 10)
}

/** Pad a number to two digits */
function pad2(n) { return String(n).padStart(2, '0') }

/**
 * Build a minimal ICS calendar invite string.
 */
function buildIcs({ uid, dtstart, dtend, summary, description, location, organizerEmail, organizerName, attendeeEmail }) {
  const fmt = (d) => {
    const dt = new Date(d)
    return [
      dt.getUTCFullYear(),
      pad2(dt.getUTCMonth() + 1),
      pad2(dt.getUTCDate()),
      'T',
      pad2(dt.getUTCHours()),
      pad2(dt.getUTCMinutes()),
      '00Z',
    ].join('')
  }

  const now = fmt(new Date())
  const start = fmt(dtstart)
  // Default duration: 1 hour if dtend not supplied
  const end = dtend ? fmt(dtend) : fmt(new Date(new Date(dtstart).getTime() + 60 * 60 * 1000))

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WinMovers Operations//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    location    ? `LOCATION:${location}` : '',
    `ORGANIZER;CN=${organizerName || organizerEmail}:mailto:${organizerEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${attendeeEmail}:mailto:${attendeeEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

// ── Visit notifications ───────────────────────────────────────────────────────

const VISIT_SERVICE_TYPE_ES = {
  DOOR_TO_PORT: 'Puerta a Puerto',
  DOOR_TO_DOOR: 'Puerta a Puerta',
  PACKING:      'Empaque',
  LOCAL_MOVE:   'Mudanza Local',
}

const VISIT_BOOKER_ROLE_ES = {
  BOOKER: 'Agente',
  OA:     'Agente de Origen',
}

const VISIT_LANGUAGE_ES = {
  EN: 'Inglés',
  ES: 'Español',
}

/**
 * Send a calendar invite to the assigned staff member when a visit is scheduled.
 *
 * @param {object} visit  — full visit record (must include assignedTo, client, corporateClient, originAgent, destAgent)
 * @param {'created'|'updated'} action
 */
async function notifyVisitAssigned(visit, action = 'created') {
  try {
    const assignee = visit.assignedTo
    if (!assignee?.email) return           // no email → nothing to send
    if (!visit.scheduledDate) return       // no date → no calendar invite

    const from  = process.env.AZURE_MAIL_FROM

    // Build individual and company labels independently
    const individualName = visit.client
      ? (`${visit.client.firstName || ''} ${visit.client.lastName || ''}`.trim() || visit.client.name)
      : null
    const companyName = visit.corporateClient?.name || null
    const prospectName = (!individualName && !companyName) ? (visit.prospectName || 'Cliente desconocido') : null

    // Summary label used in subject / ICS (prefer company, fall back to individual or prospect)
    const clientLabel = companyName || individualName || prospectName

    // Resolve contact phone & email (prefer linked client record, fall back to prospect fields)
    const contactPhone = visit.client?.phone || visit.corporateClient?.phone || visit.prospectPhone || null
    const contactEmail = visit.client?.email || visit.corporateClient?.email || visit.prospectEmail || null

    const originParts = [visit.originAddress, visit.originCity, visit.originCountry].filter(Boolean)
    const destParts   = [visit.destAddress,   visit.destCity,   visit.destCountry  ].filter(Boolean)
    const location    = originParts.join(', ') || undefined

    const serviceTypeLabel = VISIT_SERVICE_TYPE_ES[visit.serviceType] || (visit.serviceType?.replace(/_/g, ' ') ?? null)
    const bookerRoleLabel  = visit.bookerRole ? (VISIT_BOOKER_ROLE_ES[visit.bookerRole] || visit.bookerRole) : null
    const languageLabel    = visit.language   ? (VISIT_LANGUAGE_ES[visit.language]      || visit.language)   : null

    const icsDescLines = [
      `Referencia: ${visit.visitNumber}`,
      companyName    ? `Empresa: ${companyName}`                              : '',
      individualName ? `Contacto: ${individualName}`                          : '',
      prospectName   ? `Prospecto: ${prospectName}`                           : '',
      contactPhone          ? `Teléfono: ${contactPhone}`                    : '',
      contactEmail          ? `Correo: ${contactEmail}`                       : '',
      originParts.length    ? `Origen: ${originParts.join(', ')}`             : '',
      destParts.length      ? `Destino: ${destParts.join(', ')}`              : '',
      serviceTypeLabel      ? `Servicio: ${serviceTypeLabel}`                 : '',
      bookerRoleLabel       ? `Rol del agente: ${bookerRoleLabel}`            : '',
      visit.originAgent     ? `Agente de origen: ${visit.originAgent.name}`  : '',
      visit.destAgent       ? `Agente de destino: ${visit.destAgent.name}`   : '',
      languageLabel         ? `Idioma: ${languageLabel}`                      : '',
      visit.observations    ? `\nNotas: ${visit.observations}`                : '',
    ].filter(Boolean)

    const ics = buildIcs({
      uid:            `visit-${visit.id}@winmovers.com`,
      dtstart:        visit.scheduledDate,
      summary:        `Visita ${visit.visitNumber} — ${clientLabel}`,
      description:    icsDescLines.join('\n'),
      location,
      organizerEmail: from,
      organizerName:  'WinMovers Operations',
      attendeeEmail:  assignee.email,
    })

    const subject = action === 'created'
      ? `[Visita] ${visit.visitNumber} asignada — ${formatDate(visit.scheduledDate)}`
      : `[Visita] ${visit.visitNumber} actualizada — ${formatDate(visit.scheduledDate)}`

    const row = (label, value) =>
      value ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;white-space:nowrap">${label}</td><td>${value}</td></tr>` : ''

    const html = `
      <p>Hola ${assignee.name || assignee.email},</p>
      <p>${action === 'created' ? 'Se te ha asignado la visita' : 'Se actualizó la visita'} <strong>${visit.visitNumber}</strong>.</p>
      <table style="border-collapse:collapse;font-size:14px;margin:16px 0">
        ${row('Visita',            visit.visitNumber)}
        ${companyName    ? row('Empresa',  `<strong>${companyName}</strong>`)    : ''}
        ${individualName ? row('Contacto', `<strong>${individualName}</strong>`) : ''}
        ${prospectName   ? row('Prospecto',`<strong>${prospectName}</strong>`)   : ''}
        ${row('Fecha y hora',      formatDate(visit.scheduledDate))}
        ${row('Teléfono',          contactPhone)}
        ${row('Correo',            contactEmail)}
        ${row('Dirección origen',  originParts.length ? originParts.join(', ') : null)}
        ${row('Dirección destino', destParts.length   ? destParts.join(', ')   : null)}
        ${row('Servicio',          serviceTypeLabel)}
        ${row('Rol del agente',    bookerRoleLabel)}
        ${row('Asignado a',        assignee.name || assignee.email)}
        ${row('Idioma',            languageLabel)}
        ${row('Agente de origen',  visit.originAgent?.name)}
        ${row('Agente de destino', visit.destAgent?.name)}
        ${row('Observaciones',     visit.observations)}
      </table>
      <p style="color:#64748b;font-size:12px">Se adjunta invitación al calendario. — WinMovers Operations</p>
    `

    let mailErr = null
    try {
      await sendMail({
        to:      assignee.email,
        subject,
        html,
        // Attach the .ics as base64 inline — Graph sendMail accepts attachments array
        _attachments: [
          {
            '@odata.type':  '#microsoft.graph.fileAttachment',
            name:           'invite.ics',
            contentType:    'text/calendar; method=REQUEST',
            contentBytes:   Buffer.from(ics).toString('base64'),
          },
        ],
      })
    } catch (err) {
      mailErr = err
      console.error('[notify] visitAssigned error:', err.message)
    }
    await logEmail('Visit', visit.id, assignee.email, subject, mailErr ? 'FAILED' : 'SENT', mailErr?.message)
  } catch (err) {
    console.error('[notify] visitAssigned error:', err.message)
  }
}

// ── File notifications ────────────────────────────────────────────────────────

/**
 * Send a notification to the coordinator when a file is assigned to them.
 *
 * @param {object} file    — full file record (must include coordinator)
 * @param {'created'|'reassigned'} action
 */
const FILE_CATEGORY_ES = {
  EXPORT: 'Exportación',
  IMPORT: 'Importación',
  LOCAL:  'Local',
}

const FILE_SERVICE_TYPE_ES = {
  DOOR_TO_PORT: 'Puerta a Puerto',
  DOOR_TO_DOOR: 'Puerta a Puerta',
  PORT_TO_DOOR: 'Puerto a Puerta',
  LOCAL_MOVE:   'Mudanza Local',
}

async function notifyFileCoordinator(file, action = 'created') {
  try {
    const coordinator = file.coordinator
    if (!coordinator?.email) return

    const clientLabel = file.corporateClient?.name
      || (file.client
          ? (file.client.clientType === 'INDIVIDUAL'
              ? `${file.client.firstName || ''} ${file.client.lastName || ''}`.trim() || file.client.name
              : file.client.name)
          : null)
      || 'Cliente desconocido'

    const subject = action === 'created'
      ? `[Expediente] ${file.fileNumber} asignado`
      : `[Expediente] ${file.fileNumber} reasignado`

    const html = `
      <p>Hola ${coordinator.name || coordinator.email},</p>
      <p>Eres el/la coordinador/a del expediente <strong>${file.fileNumber}</strong>${action === 'reassigned' ? ' (reasignado)' : ''}.</p>
      <table style="border-collapse:collapse;font-size:14px;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Expediente</td><td><strong>${file.fileNumber}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Tipo</td><td>${FILE_CATEGORY_ES[file.category] || file.category}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Cliente</td><td>${clientLabel}</td></tr>
        ${file.serviceType ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Servicio</td><td>${FILE_SERVICE_TYPE_ES[file.serviceType] || file.serviceType.replace(/_/g, ' ')}</td></tr>` : ''}
        ${file.eta ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">ETA</td><td>${formatDateShort(file.eta)}</td></tr>` : ''}
        ${file.etd ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">ETD</td><td>${formatDateShort(file.etd)}</td></tr>` : ''}
        ${file.notes ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Notas</td><td>${file.notes}</td></tr>` : ''}
      </table>
      <p style="color:#64748b;font-size:12px">— WinMovers Operations</p>
    `

    let mailErr = null
    try {
      await sendMail({ to: coordinator.email, subject, html })
    } catch (err) {
      mailErr = err
      console.error('[notify] fileCoordinator error:', err.message)
    }
    await logEmail('MovingFile', file.id, coordinator.email, subject, mailErr ? 'FAILED' : 'SENT', mailErr?.message)
  } catch (err) {
    console.error('[notify] fileCoordinator error:', err.message)
  }
}

module.exports = { notifyVisitAssigned, notifyFileCoordinator }
