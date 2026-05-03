/**
 * Notification helpers — called fire-and-forget from route handlers.
 * All functions catch their own errors so a mail failure never breaks the API response.
 */
const { sendMail } = require('./graph')

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

/**
 * Send a calendar invite to the assigned staff member when a visit is scheduled.
 *
 * @param {object} visit  — full visit record (must include assignedTo)
 * @param {'created'|'updated'} action
 */
async function notifyVisitAssigned(visit, action = 'created') {
  try {
    const assignee = visit.assignedTo
    if (!assignee?.email) return           // no email → nothing to send
    if (!visit.scheduledDate) return       // no date → no calendar invite

    const from  = process.env.AZURE_MAIL_FROM
    const clientLabel = visit.corporateClient?.name
      || visit.client?.name
      || visit.prospectName
      || 'Unknown client'

    // Resolve contact phone & email (prefer linked client record, fall back to prospect fields)
    const contactPhone = visit.client?.phone || visit.corporateClient?.phone || visit.prospectPhone || null
    const contactEmail = visit.client?.email || visit.corporateClient?.email || visit.prospectEmail || null

    const locationParts = [visit.originAddress, visit.originCity, visit.originCountry].filter(Boolean)
    const location = locationParts.join(', ') || undefined

    const ics = buildIcs({
      uid:            `visit-${visit.id}@winmovers.com`,
      dtstart:        visit.scheduledDate,
      summary:        `Visita ${visit.visitNumber} — ${clientLabel}`,
      description:    [
        `Referencia: ${visit.visitNumber}`,
        `Cliente: ${clientLabel}`,
        contactPhone ? `Teléfono: ${contactPhone}` : '',
        contactEmail ? `Correo: ${contactEmail}` : '',
        visit.observations ? `\nNotas: ${visit.observations}` : '',
      ].filter(Boolean).join('\n'),
      location,
      organizerEmail: from,
      organizerName:  'WinMovers Operations',
      attendeeEmail:  assignee.email,
    })

    const subject = action === 'created'
      ? `[Visita] ${visit.visitNumber} asignada — ${formatDate(visit.scheduledDate)}`
      : `[Visita] ${visit.visitNumber} actualizada — ${formatDate(visit.scheduledDate)}`

    const html = `
      <p>Hola ${assignee.name || assignee.email},</p>
      <p>Se te ha asignado la visita <strong>${visit.visitNumber}</strong>.</p>
      <table style="border-collapse:collapse;font-size:14px;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Cliente</td><td><strong>${clientLabel}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Fecha y hora</td><td>${formatDate(visit.scheduledDate)}</td></tr>
        ${contactPhone ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Teléfono</td><td>${contactPhone}</td></tr>` : ''}
        ${contactEmail ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Correo</td><td>${contactEmail}</td></tr>` : ''}
        ${location ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Dirección</td><td>${location}</td></tr>` : ''}
        ${visit.serviceType ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Servicio</td><td>${visit.serviceType.replace(/_/g, ' ')}</td></tr>` : ''}
        ${visit.observations ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Observaciones</td><td>${visit.observations}</td></tr>` : ''}
      </table>
      <p style="color:#64748b;font-size:12px">Se adjunta invitación al calendario. — WinMovers Operations</p>
    `

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

    await sendMail({ to: coordinator.email, subject, html })
  } catch (err) {
    console.error('[notify] fileCoordinator error:', err.message)
  }
}

module.exports = { notifyVisitAssigned, notifyFileCoordinator }
