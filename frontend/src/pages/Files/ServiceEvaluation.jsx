import { forwardRef } from 'react'

const CONTACT_INFO = [
  'Tel: (506) 2215-3536',
  'Fax: (506) 2215-3530',
  'E-mail: sales@winmovers.com',
  'Autopista a Santa Ana, 800 Mts. Norte de',
  'Multiplaza, Complejo Attica, Bodega Nº 10, San José, Costa Rica',
]

const QUESTIONS = [
  {
    es: 'Evalue el servicio recibido del ejecutivo de trafico de Winmovers',
    en: 'Rate the service provided by our Winmovers traffic executive',
  },
  {
    es: '¿Brindo WinMovers el servicio en la fecha acordada?',
    en: 'Did WinMovers give the service on the promised date?',
  },
  {
    es: '¿Fueron amables y serviciales los empleados de WinMovers?',
    en: 'Were the crew members nice and helpful?',
  },
  {
    es: '¿Los materiales usados durante el servicio ofrecido fueron de su agrado?',
    en: 'Were you satisfied with materials used during service given?',
  },
  {
    es: '¿Como califiaria usted la apariencia de los empleados de WinMovers?',
    en: 'How would you rate WinMovers crew appearence?',
  },
  {
    es: '¿Cree usted que nuestro servicio fue realizado con profesionalismo?',
    en: 'Do you feel our service was done professionally?',
  },
]

// 0=excellent, 1=vgood, 2=good, 3=regular, 4=poor
export const EMPTY_SE = {
  ratings: Array(6).fill(null),
  overallRating: '',
  unpackedComplete: null,
  unpackedByCustomer: null,
  comments: '',
}

const RATING_COLS = [0, 1, 2, 3, 4]

const ServiceEvaluation = forwardRef(function ServiceEvaluation(
  { file, headerRef, editMode = false, data = EMPTY_SE, onChange },
  ref
) {
  const job = file?.job
  const clientName = file?.client
    ? (file.client.clientType === 'INDIVIDUAL'
        ? `${file.client.firstName || ''} ${file.client.lastName || ''}`.trim() || file.client.name
        : file.client.name)
    : ''
  const destAddr = [job?.destCity, job?.destCountry].filter(Boolean).join(', ')
  const phone    = file?.client?.phone || ''

  const refDate = job?.serviceDate ? new Date(job.serviceDate) : new Date()
  const day     = refDate.getDate()
  const month   = refDate.toLocaleDateString('en-US', { month: 'long' })
  const year    = refDate.getFullYear()

  const ratings          = data?.ratings          ?? EMPTY_SE.ratings
  const overallRating    = data?.overallRating     ?? ''
  const unpackedComplete = data?.unpackedComplete  ?? null
  const unpackedByCustomer = data?.unpackedByCustomer ?? null
  const comments         = data?.comments          ?? ''

  const setRating = (qIdx, col) => {
    if (!onChange) return
    const newRatings = ratings.map((v, i) => i === qIdx ? (v === col ? null : col) : v)
    onChange({ ...data, ratings: newRatings })
  }
  const setYN = (field, val) => onChange && onChange({ ...data, [field]: data[field] === val ? null : val })

  const rtgCellStyle = (qIdx, col) => ({
    cursor: editMode ? 'pointer' : 'default',
    background: ratings[qIdx] === col ? '#1565c0' : 'transparent',
    transition: 'background 0.15s',
  })
  const ynBoxStyle = (field, val) => ({
    cursor: editMode ? 'pointer' : 'default',
    background: data?.[field] === val ? '#1565c0' : 'transparent',
    transition: 'background 0.15s',
  })

  return (
    <div className="qd-outer-wrapper">
      <div ref={headerRef} className="qd-page-header">
        <img src="/winmovers-logo.jpg" className="qd-header-logo" alt="WinMovers"
             onError={e => { e.currentTarget.style.display = 'none' }} />
        <div className="qd-header-contact">
          {CONTACT_INFO.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </div>

      <div className="job-document" ref={ref}>
        <table className="se-table">
          {/* 7 columns: Q#(5%) | Text(47%) | 5×rating(9.6%) */}
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '47%' }} />
            <col style={{ width: '9.6%' }} />
            <col style={{ width: '9.6%' }} />
            <col style={{ width: '9.6%' }} />
            <col style={{ width: '9.6%' }} />
            <col style={{ width: '9.6%' }} />
          </colgroup>
          <tbody>

            {/* Title */}
            <tr>
              <td colSpan={7} className="se-title">
                Evaluación del servicio / Service evaluation
              </td>
            </tr>

            {/* Client name / Date */}
            <tr>
              <td colSpan={4} className="se-hdr-cell">
                <div className="se-lbl">Nombre del cliente / Customer's name</div>
                <div className="se-val">{clientName}</div>
              </td>
              <td className="se-hdr-cell se-center">
                <div className="se-lbl">Día / Day</div>
                <div className="se-val">{day}</div>
              </td>
              <td className="se-hdr-cell se-center">
                <div className="se-lbl">Mes / Month</div>
                <div className="se-val">{month}</div>
              </td>
              <td className="se-hdr-cell se-center">
                <div className="se-lbl">Año / Year</div>
                <div className="se-val">{year}</div>
              </td>
            </tr>

            {/* Address / Phone */}
            <tr>
              <td colSpan={4} className="se-hdr-cell">
                <div className="se-lbl">Direcciòn / Delivery address</div>
                <div className="se-val">{destAddr}</div>
              </td>
              <td colSpan={3} style={{ padding: 0 }}>
                <div className="se-lbl" style={{ padding: '4px 7px 3px', borderBottom: '1px solid #000' }}>
                  Teléfonos / Telephone numbers
                </div>
                <div style={{ display: 'flex' }}>
                  <div style={{ flex: 1, borderRight: '1px solid #bbb', padding: '3px 7px' }}>
                    <div className="se-sublbl">Casa / Home</div>
                    <div className="se-val">{phone}</div>
                  </div>
                  <div style={{ flex: 1, padding: '3px 7px' }}>
                    <div className="se-sublbl">Cel. / Móvil</div>
                    <div className="se-val" />
                  </div>
                </div>
              </td>
            </tr>

            {/* Spacer */}
            <tr><td colSpan={7} style={{ height: 10 }} /></tr>

            {/* Rating column headers */}
            <tr>
              <td colSpan={2} />
              <td className="se-rtg-hdr">Excelente<br />Excellent</td>
              <td className="se-rtg-hdr">Muy bueno<br />Very good</td>
              <td className="se-rtg-hdr">Bueno<br />Good</td>
              <td className="se-rtg-hdr">Regular<br />Regular</td>
              <td className="se-rtg-hdr">Malo<br />Poor</td>
            </tr>

            {/* Questions */}
            {QUESTIONS.map((q, i) => (
              <tr key={i} className="se-q-row">
                <td className="se-q-num">{i + 1}.</td>
                <td className="se-q-txt">
                  <div className="se-q-es">{q.es}</div>
                  <div className="se-q-en">{q.en}</div>
                </td>
                {RATING_COLS.map(col => (
                  <td key={col} className="se-rtg-cell"
                    style={rtgCellStyle(i, col)}
                    onClick={() => editMode && setRating(i, col)}
                  />
                ))}
              </tr>
            ))}

            {/* Overall rating */}
            <tr>
              <td colSpan={7} className="se-overall-td">
                <div className="se-q-es">
                  En general usando una escala del 1 al 100 como calificaria usted el servicio que WinMovers le brindò
                </div>
                <div className="se-q-en">
                  Overall, using a scale from 1 to 100 how would you rate the service you received from WinMovers?
                </div>
                {editMode
                  ? <input type="number" min={1} max={100}
                      value={overallRating}
                      onChange={e => onChange && onChange({ ...data, overallRating: e.target.value })}
                      style={{ marginTop: 6, width: 80, fontSize: '11pt', padding: '2px 6px',
                               background: '#fffbe6', border: '1px solid #ccc', borderRadius: 3 }} />
                  : overallRating
                    ? <div style={{ marginTop: 6, fontSize: '13pt', fontWeight: 700 }}>{overallRating}</div>
                    : null
                }
              </td>
            </tr>

            {/* Spacer */}
            <tr><td colSpan={7} style={{ height: 10 }} /></tr>

            {/* Yes/No header */}
            <tr>
              <td colSpan={5} style={{ border: 'none', borderLeft: '1px solid #000' }} />
              <td className="se-yn-hdr">Sí / Yes</td>
              <td className="se-yn-hdr">NO</td>
            </tr>

            {/* Yes/No row 1 */}
            <tr>
              <td colSpan={5} className="se-yn-q">
                <div className="se-q-es">Se realizo el desempaque total de los bultos</div>
                <div className="se-q-en">Unpacked was totally complete</div>
              </td>
              <td className="se-yn-cell" onClick={() => editMode && setYN('unpackedComplete', true)}>
                <div className="se-yn-box" style={ynBoxStyle('unpackedComplete', true)} />
              </td>
              <td className="se-yn-cell" onClick={() => editMode && setYN('unpackedComplete', false)}>
                <div className="se-yn-box" style={ynBoxStyle('unpackedComplete', false)} />
              </td>
            </tr>

            {/* Yes/No row 2 */}
            <tr>
              <td colSpan={5} className="se-yn-q">
                <div className="se-q-es">De acuerdo a instrucciones del cliente, quedan bultos que seràn desempacados por su cuenta</div>
                <div className="se-q-en">By instructions of the customer, there are packages will be unpacked by himself</div>
              </td>
              <td className="se-yn-cell" onClick={() => editMode && setYN('unpackedByCustomer', true)}>
                <div className="se-yn-box" style={ynBoxStyle('unpackedByCustomer', true)} />
              </td>
              <td className="se-yn-cell" onClick={() => editMode && setYN('unpackedByCustomer', false)}>
                <div className="se-yn-box" style={ynBoxStyle('unpackedByCustomer', false)} />
              </td>
            </tr>

            {/* Comments */}
            <tr>
              <td colSpan={7} className="se-comments-td">
                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: '10pt' }}>Comentarios / Comments:</div>
                {editMode
                  ? <textarea rows={3} value={comments}
                      onChange={e => onChange && onChange({ ...data, comments: e.target.value })}
                      style={{ width: '100%', fontFamily: "'Times New Roman', Times, serif", fontSize: '10.5pt',
                               padding: '4px 6px', background: '#fffbe6', border: '1px solid #ccc',
                               borderRadius: 3, resize: 'vertical', boxSizing: 'border-box' }} />
                  : <div style={{ minHeight: 48, whiteSpace: 'pre-wrap' }}>{comments}</div>
                }
              </td>
            </tr>
            <tr><td colSpan={7} style={{ height: 20, borderTop: 'none' }} /></tr>

            {/* Signature */}
            <tr>
              <td colSpan={7} className="se-sig-td">
                <div className="se-sig-line-wrap">
                  Firma del cliente / Customer's signature
                </div>
              </td>
            </tr>

            {/* Footer */}
            <tr>
              <td colSpan={7} className="se-footer-td">
                <em>Gracias por su colaboracíon / Thank you for taking the time to complete this evaluation!</em>
              </td>
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  )
})

export default ServiceEvaluation
