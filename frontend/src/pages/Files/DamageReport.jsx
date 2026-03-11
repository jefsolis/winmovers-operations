import { forwardRef } from 'react'

const CONTACT_INFO = [
  'Tel: (506) 2215-3536',
  'Fax: (506) 2215-3530',
  'E-mail: sales@winmovers.com',
  'Autopista a Santa Ana, 800 Mts. Norte de',
  'Multiplaza, Complejo Attica, Bodega Nº 10, San José, Costa Rica',
]

export const EMPTY_DR = {
  items: Array.from({ length: 15 }, () => ({ no: '', item: '', condition: '' })),
  unpacking: null,
}

const DamageReport = forwardRef(function DamageReport(
  { file, headerRef, editMode = false, data = EMPTY_DR, onChange },
  ref
) {
  const job = file?.job
  const clientName = file?.client
    ? (file.client.clientType === 'INDIVIDUAL'
        ? `${file.client.firstName || ''} ${file.client.lastName || ''}`.trim() || file.client.name
        : file.client.name)
    : ''
  const originAddr = [job?.originCity, job?.originCountry].filter(Boolean).join(', ')
  const destAddr   = [job?.destCity,   job?.destCountry  ].filter(Boolean).join(', ')

  const items    = data?.items    ?? EMPTY_DR.items
  const unpacking = data?.unpacking ?? null

  const setItem = (idx, field, value) => {
    if (!onChange) return
    const newItems = items.map((row, i) => i === idx ? { ...row, [field]: value } : row)
    onChange({ ...data, items: newItems })
  }
  const setUnpacking = (val) => onChange && onChange({ ...data, unpacking: val })

  const inputStyle = {
    border: 'none', background: editMode ? '#fffbe6' : 'transparent',
    fontFamily: "'Times New Roman', Times, serif", fontSize: '10.5pt',
    width: '100%', padding: '2px 4px', outline: 'none', boxSizing: 'border-box',
  }

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
        <div className="dr-title">DAMAGE REPORT</div>

        <table className="dr-table">
          <tbody>
            {/* Header fields */}
            <tr>
              <td className="dr-lbl">Shipper:</td>
              <td className="dr-val" colSpan={2}>{clientName}</td>
            </tr>
            <tr>
              <td className="dr-lbl">Origin Address:</td>
              <td className="dr-val" colSpan={2}>{originAddr}</td>
            </tr>
            <tr>
              <td className="dr-lbl">Destination Address:</td>
              <td className="dr-val" colSpan={2}>{destAddr}</td>
            </tr>

            {/* Section header */}
            <tr>
              <td className="dr-sec-hdr" colSpan={3}>
                ITEMS REPORTED BY SHIPPER AS MISSING OR DAMAGED AT THE TIME OF THE DELIVERY
              </td>
            </tr>

            <tr><td colSpan={3} style={{ height: 10, border: 'none' }} /></tr>

            {/* Column headers */}
            <tr>
              <td className="dr-col-hdr" style={{ width: '14%' }}>ITEM NO.</td>
              <td className="dr-col-hdr" style={{ width: '54%' }}>ITEM</td>
              <td className="dr-col-hdr" style={{ width: '32%' }}>CONDITION REPORTED</td>
            </tr>

            {/* 15 data rows */}
            {items.map((row, i) => (
              <tr key={i} className="dr-data-row">
                <td>
                  {editMode
                    ? <input style={inputStyle} value={row.no} onChange={e => setItem(i, 'no', e.target.value)} />
                    : row.no}
                </td>
                <td>
                  {editMode
                    ? <input style={inputStyle} value={row.item} onChange={e => setItem(i, 'item', e.target.value)} />
                    : row.item}
                </td>
                <td>
                  {editMode
                    ? <input style={inputStyle} value={row.condition} onChange={e => setItem(i, 'condition', e.target.value)} />
                    : row.condition}
                </td>
              </tr>
            ))}

            {/* Unpacking options */}
            <tr>
              <td colSpan={3} className="dr-unpack-td">
                {[
                  { key: 'complete', label: 'COMPLETE UNPACKING PERFORMED', cls: 'dr-blue' },
                  { key: 'partial',  label: 'PARTIAL UNPACKING REQUESTED',  cls: 'dr-amber' },
                  { key: 'none',     label: 'NO UNPACKING REQUESTED',       cls: 'dr-blue' },
                ].map(opt => (
                  <div key={opt.key} className="dr-unpack-row"
                    style={{ cursor: editMode ? 'pointer' : 'default' }}
                    onClick={() => editMode && setUnpacking(unpacking === opt.key ? null : opt.key)}
                  >
                    <span className="dr-circle" style={{
                      background: unpacking === opt.key ? '#1565c0' : 'transparent',
                      transition: 'background 0.15s',
                    }} />
                    <span className={opt.cls}>{opt.label}</span>
                  </div>
                ))}
              </td>
            </tr>

            {/* Signature rows */}
            <tr>
              <td colSpan={2}>
                <div className="dr-sig-flex">
                  <span className="dr-sig-lbl">SHIPPERS'S SIGNATURE</span>
                  <span className="dr-sig-line" style={{ flex: 1 }} />
                  <span className="dr-sig-lbl" style={{ marginLeft: 20 }}>DATE:</span>
                  <span className="dr-sig-line" style={{ width: 100 }} />
                </div>
              </td>
              <td />
            </tr>
            <tr>
              <td colSpan={2}>
                <div className="dr-sig-flex">
                  <span className="dr-sig-lbl">CREW LEADER'S SIGNATURE</span>
                  <span className="dr-sig-line" style={{ flex: 1 }} />
                  <span className="dr-sig-lbl" style={{ marginLeft: 20 }}>DATE:</span>
                  <span className="dr-sig-line" style={{ width: 100 }} />
                </div>
              </td>
              <td />
            </tr>

            {/* Footer */}
            <tr>
              <td colSpan={3} className="dr-footer-td">
                THIS IS AN EXCEPTION REPORT, NOT A CLAIM FORM
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
})

export default DamageReport
