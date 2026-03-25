import { forwardRef } from 'react'

const CONTACT_INFO = [
  'Tel: (506) 2215-3536',
  'Fax: (506) 2215-3530',
  'E-mail: sales@winmovers.com',
  'Autopista a Santa Ana, 800 Mts. Norte de',
  'Multiplaza, Complejo Attica, Bodega N\u00ba 10, San Jos\u00e9, Costa Rica',
]

const LABELS = {
  title:          'ORDEN DE TRABAJO',
  serviceDate:    'Fecha de Servicio',
  ot:             'O.T.',
  date:           'Fecha',
  time:           'Hora',
  clientName:     'Nombre del Cliente',
  cellPhone:      'Tel. Celular',
  homePhone:      'Tel. Residencia',
  company:        'Compañía',
  companyPhone:   'Tel. Empresa',
  address:        'Dirección de Origen',
  destAddress:    'Dirección de Destino',
  serviceDetails: 'Detalle del Servicio',
  materials:      'Materiales',
  volume:         'Volumen (CBM)',
  weight:         'Peso (Kg)',
  quoteTo:        'Facturar a Nombre de',
  createdBy:      'Hecho por',
  coordinator:    'Coordinador',
  // Import-only
  contacto:       'Contacto',
  bultos:         'Cantidad de Bultos',
  weightCarga:    'Peso de la Carga (Kg)',
  personalCount:  'Cantidad de Personal',
  transbordo:     'Transbordo',
  paisOrigen:     'País de Origen',
}

function fmtDate(v) {
  if (!v) return ''
  try { return new Date(v).toLocaleDateString('en-GB') } catch { return '' }
}

function formatTime12h(v) {
  if (!v) return ''
  const [hStr, mStr] = v.split(':')
  let h = parseInt(hStr, 10)
  if (isNaN(h)) return v
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${mStr || '00'} ${ampm}`
}

const SEL_STYLE = {
  border: 'none', background: 'transparent',
  fontFamily: "'Times New Roman', Times, serif", fontSize: '11pt',
  padding: '2px 4px', outline: 'none', cursor: 'pointer',
}

function TimePicker12h({ value, onChange }) {
  let hDisp = 12, mDisp = '00', ampm = 'AM'
  if (value) {
    const [hStr, mStr] = value.split(':')
    const h24 = parseInt(hStr, 10) || 0
    ampm  = h24 >= 12 ? 'PM' : 'AM'
    hDisp = h24 % 12 || 12
    mDisp = mStr || '00'
  }
  const commit = (h, m, ap) => {
    let h24 = h % 12
    if (ap === 'PM') h24 += 12
    onChange(`${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', gap: 2 }}>
      <select style={SEL_STYLE} value={hDisp} onChange={e => commit(parseInt(e.target.value), mDisp, ampm)}>
        {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <span style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '11pt' }}>:</span>
      <select style={SEL_STYLE} value={mDisp} onChange={e => commit(hDisp, e.target.value, ampm)}>
        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
      <select style={SEL_STYLE} value={ampm} onChange={e => commit(hDisp, mDisp, e.target.value)}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}

function Row({ children, tall }) {
  return <div className={`jd-row${tall ? ' jd-row-tall' : ''}`}>{children}</div>
}

// A cell: label + (editable input | derived span | plain span)
function Cell({ label, value, editMode, onChange, inputType = 'text', flex, borderRight, top }) {
  const editable = editMode && typeof onChange === 'function'
  return (
    <div
      className={`jd-cell${top ? ' jd-cell-top' : ''}`}
      style={{ flex: flex || 1, borderRight: borderRight ? '1px solid #bbb' : 'none' }}
    >
      <span className="jd-cell-label">{label}</span>
      {editable ? (
        inputType === 'textarea' ? (
          <textarea
            className="jd-cell-textarea"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
          />
        ) : (
          <input
            className="jd-cell-input"
            type={inputType}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
          />
        )
      ) : (
        <span className={`jd-cell-value${editMode ? ' jd-cell-derived' : ''}`}>
          {value}
        </span>
      )}
    </div>
  )
}

/**
 * JobDocument
 * View mode  (editMode=false): pass `job`.
 * Edit mode  (editMode=true):  pass `form`, `onFormChange`, `clients`, `onClientChange`.
 */
const JobDocument = forwardRef(function JobDocument(
  {
    job,
    editMode = false,
    form,
    onFormChange,
    clients = [],
    onClientChange,
    resolvedJobNumber = '',
    resolvedCreatedDate = '',
    headerRef,
    staffMembers = [],
    coordinatorStaff = [],
  },
  ref
) {
  const L = LABELS

  // View-mode derived values
  const viewClientName = job?.client?.clientType === 'INDIVIDUAL'
    ? `${job?.client?.firstName || ''} ${job?.client?.lastName || ''}`.trim() || job?.client?.name
    : job?.client?.name || ''
  const viewOriginAddr = [job?.originAddress, job?.originCity, job?.originCountry].filter(Boolean).join(', ')
  const viewDestAddr   = [job?.destAddress,   job?.destCity,   job?.destCountry  ].filter(Boolean).join(', ')

  const jobNumber   = editMode ? resolvedJobNumber   : (job?.jobNumber || '')
  const createdDate = editMode ? resolvedCreatedDate : fmtDate(job?.createdAt)
  const serviceDate = editMode ? (form?.serviceDate || '') : fmtDate(job?.serviceDate)

  const ch = field => (editMode && onFormChange) ? (v => onFormChange(field, v)) : undefined
  const fv = field => editMode ? (form?.[field] ?? '') : (job?.[field] ?? '')
  const isImport = editMode ? form?.type === 'IMPORT' : job?.type === 'IMPORT'

  // Inline select style for edit mode pickers
  const selectStyle = {
    flex: 1, border: 'none', background: 'transparent',
    fontFamily: "'Times New Roman', Times, serif", fontSize: '11pt',
    padding: '5px 8px', outline: 'none', width: '100%', minWidth: 0, cursor: 'pointer',
  }
  // Inline address input style
  const addrInput = (placeholder, value, onChange, flex = 1) => (
    <input
      className="jd-cell-input"
      style={{ flex }}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )

  return (
    <div className="qd-outer-wrapper">
      <div ref={headerRef} className="qd-page-header">
        <img
          src="/winmovers-logo.jpg"
          className="qd-header-logo"
          alt="WinMovers"
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
        <div className="qd-header-contact">
          {CONTACT_INFO.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </div>

      <div className="job-document" ref={ref}>
        <div className="jd-title">{L.title}</div>

        <div className="jd-form">

          {/* Row 1: Service Date | O.T. | Date */}
          <Row>
            <Cell
              label={L.serviceDate} value={serviceDate}
              editMode={editMode} onChange={ch('serviceDate')} inputType="date"
              flex={3} borderRight top
            />
            <Cell label={L.ot}   value={jobNumber}   flex={2} borderRight top editMode={editMode} />
            <Cell label={L.date} value={createdDate} flex={2}              top editMode={editMode} />
          </Row>

          {/* Row 2: Time */}
          <Row>
            <div className="jd-cell" style={{ flex: 1 }}>
              <span className="jd-cell-label">{L.time}</span>
              {editMode
                ? <TimePicker12h value={fv('serviceTime')} onChange={ch('serviceTime')} />
                : <span className="jd-cell-value">{formatTime12h(fv('serviceTime'))}</span>
              }
            </div>
          </Row>

          {/* Row 3: Client picker (edit) / Client Name (view) | Cell Phone */}
          <Row>
            <div className="jd-cell" style={{ flex: 3, borderRight: '1px solid #bbb' }}>
              <span className="jd-cell-label">{L.clientName}</span>
              {editMode ? (
                <select style={selectStyle} value={form?.clientId || ''} onChange={e => onClientChange?.(e.target.value)}>
                  <option value="">—</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <span className="jd-cell-value">{viewClientName}</span>
              )}
            </div>
            <Cell label={L.cellPhone} value={fv('clientPhone')} flex={2} editMode={editMode} onChange={ch('clientPhone')} />
          </Row>

          {/* Row 4: Home Phone */}
          <Row>
            <Cell label={L.homePhone} value={fv('clientHomePhone')} editMode={editMode} onChange={ch('clientHomePhone')} />
          </Row>

          {/* Row 5: Company | Company Phone */}
          <Row>
            <Cell label={L.company}      value={fv('companyName')}  flex={3} borderRight editMode={editMode} onChange={ch('companyName')} />
            <Cell label={L.companyPhone} value={fv('companyPhone')} flex={2}             editMode={editMode} onChange={ch('companyPhone')} />
          </Row>

          {/* Contacto — Import only */}
          {isImport && (
            <Row>
              <Cell label={L.contacto} value={fv('contacto')} editMode={editMode} onChange={ch('contacto')} />
            </Row>
          )}

          {/* Row 6: Origin Address */}
          <Row>
            <div className="jd-cell jd-cell-top" style={{ flex: 1 }}>
              <span className="jd-cell-label">{L.address}</span>
              {editMode ? (
                <div style={{ flex: 1, display: 'flex', gap: 0, minWidth: 0 }}>
                  {addrInput('Street / address', fv('originAddress'), ch('originAddress'), 3)}
                  <span style={{ alignSelf: 'center', color: '#bbb' }}>|</span>
                  {addrInput('City', fv('originCity'), ch('originCity'), 2)}
                  <span style={{ alignSelf: 'center', color: '#bbb' }}>|</span>
                  {addrInput('Country', fv('originCountry'), ch('originCountry'), 1)}
                </div>
              ) : (
                <span className="jd-cell-value">{viewOriginAddr}</span>
              )}
            </div>
          </Row>

          {/* Row 7: Destination Address */}
          <Row>
            <div className="jd-cell jd-cell-top" style={{ flex: 1 }}>
              <span className="jd-cell-label">{L.destAddress}</span>
              {editMode ? (
                <div style={{ flex: 1, display: 'flex', gap: 0, minWidth: 0 }}>
                  {addrInput('Street / address', fv('destAddress'), ch('destAddress'), 3)}
                  <span style={{ alignSelf: 'center', color: '#bbb' }}>|</span>
                  {addrInput('City', fv('destCity'), ch('destCity'), 2)}
                  <span style={{ alignSelf: 'center', color: '#bbb' }}>|</span>
                  {addrInput('Country', fv('destCountry'), ch('destCountry'), 1)}
                </div>
              ) : (
                <span className="jd-cell-value">{viewDestAddr}</span>
              )}
            </div>
          </Row>

          {/* Bultos / Peso / Personal / Transbordo — Import only */}
          {isImport && (
            <>
              <Row>
                <Cell label={L.bultos}        value={fv('bultos')}        editMode={editMode} onChange={ch('bultos')}        inputType="number" flex={1} borderRight />
                <Cell label={L.personalCount} value={fv('personalCount')} editMode={editMode} onChange={ch('personalCount')} inputType="number" flex={1} />
              </Row>
              <Row>
                <Cell label={L.weightCarga} value={fv('weightKg')} editMode={editMode} onChange={ch('weightKg')} inputType="number" />
              </Row>
              <Row>
                <div className="jd-cell" style={{ flex: 1 }}>
                  <span className="jd-cell-label">{L.transbordo}</span>
                  <div style={{ display: 'flex', gap: 24, padding: '5px 8px', alignItems: 'center' }}>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: editMode ? 'pointer' : 'default' }}>
                      <input
                        type="checkbox"
                        checked={editMode ? form?.transbordo === true : job?.transbordo === true}
                        onChange={editMode ? () => onFormChange?.('transbordo', form?.transbordo === true ? null : true) : undefined}
                        readOnly={!editMode}
                      />
                      Sí
                    </label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: editMode ? 'pointer' : 'default' }}>
                      <input
                        type="checkbox"
                        checked={editMode ? form?.transbordo === false : job?.transbordo === false}
                        onChange={editMode ? () => onFormChange?.('transbordo', form?.transbordo === false ? null : false) : undefined}
                        readOnly={!editMode}
                      />
                      No
                    </label>
                  </div>
                </div>
              </Row>
            </>
          )}

          {/* Row 8: Service Details */}
          <Row tall>
            <Cell label={L.serviceDetails} value={fv('serviceDetails')} editMode={editMode} onChange={ch('serviceDetails')} inputType="textarea" top />
          </Row>

          {/* Row 9: Materials */}
          <Row tall>
            <Cell label={L.materials} value={fv('materials')} editMode={editMode} onChange={ch('materials')} inputType="textarea" top />
          </Row>

          {/* Volume | Weight | Quote To — Export / non-Import only */}
          {!isImport && (
            <>
              <Row>
                <Cell label={L.volume} value={fv('volumeCbm')} editMode={editMode} onChange={ch('volumeCbm')} inputType="number" flex={1} borderRight />
                <Cell label={L.weight} value={fv('weightKg')}  editMode={editMode} onChange={ch('weightKg')}  inputType="number" flex={1} />
              </Row>
              <Row>
                <Cell label={L.quoteTo} value={fv('quoteTo')} editMode={editMode} onChange={ch('quoteTo')} />
              </Row>
            </>
          )}

          {/* Row 11: Created By */}
          <Row>
            {editMode && staffMembers.length > 0 ? (
              <div className="jd-cell" style={{ flex: 1, borderRight: 'none' }}>
                <span className="jd-cell-label">{L.createdBy}</span>
                <select
                  className="jd-cell-input"
                  value={fv('creatorName') || ''}
                  onChange={e => ch('creatorName')(e.target.value)}
                >
                  <option value="">—</option>
                  {staffMembers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            ) : (
              <Cell label={L.createdBy} value={fv('creatorName')} editMode={editMode} onChange={ch('creatorName')} />
            )}
          </Row>

          {/* Row 12: Coordinator */}
          <Row>
            {editMode && coordinatorStaff.length > 0 ? (
              <div className="jd-cell" style={{ flex: 1, borderRight: 'none' }}>
                <span className="jd-cell-label">{L.coordinator}</span>
                <select
                  className="jd-cell-input"
                  value={fv('coordinatorId') || ''}
                  onChange={e => ch('coordinatorId')(e.target.value)}
                >
                  <option value="">—</option>
                  {coordinatorStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ) : (
              <Cell label={L.coordinator} value={editMode ? '' : (job?.coordinator?.name || '')} editMode={false} />
            )}
          </Row>

          {/* País de Origen — Import only */}
          {isImport && (
            <Row>
              <Cell label={L.paisOrigen} value={fv('originCountry')} editMode={editMode} onChange={ch('originCountry')} />
            </Row>
          )}

        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  )
})

export default JobDocument
