import { forwardRef } from 'react'
import { SECTION_KEYS, SECTION_UI_LABELS } from './quoteTemplates'


const CONTACT_INFO = {
  EN: [
    'Phone: (506) 2215-3536',
    'Fax: (506) 2215-3530',
    'E-mail: sales@winmovers.com',
    'Autopista a Santa Ana, 800 Mts. Norte de',
    'Multiplaza, Complejo Attica, Bodega N\u00ba 10, San Jos\u00e9, Costa Rica',
  ],
  ES: [
    'Tel\u00e9fono: (506) 2215-3536',
    'Fax: (506) 2215-3530',
    'E-mail: sales@winmovers.com',
    'Autopista a Santa Ana, 800 Mts. Norte de',
    'Multiplaza, Complejo Attica, Bodega N\u00ba 10, San Jos\u00e9, Costa Rica',
  ],
}

// Render text with **bold** line support
function renderFormattedText(text) {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    const m = line.match(/^\*\*(.+)\*\*$/)  // line is entirely **...**
    if (m) return <div key={i} className="qd-line qd-line-bold">{m[1]}</div>
    if (!line) return <div key={i} className="qd-line-empty" />
    return <div key={i} className="qd-line">{line}</div>
  })
}

// Auto-resize textarea helper
function autoResize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

const QuoteDocument = forwardRef(function QuoteDocument(
  { sections = {}, editMode = false, onChange, language = 'EN', quoteNumber, headerRef, footerRef, sectionKeys = SECTION_KEYS, creator, signatureDataUrl },
  ref
) {
  const labels = SECTION_UI_LABELS[language] || SECTION_UI_LABELS.EN
  const contactLines = CONTACT_INFO[language] || CONTACT_INFO.EN

  return (
    <div className="qd-outer-wrapper">
      {/* Page header — captured separately for repeating on every PDF page */}
      <div ref={headerRef} className="qd-page-header">
        <img src="/winmovers-logo.jpg" className="qd-header-logo" alt="WinMovers"
             onError={e => { e.currentTarget.style.display = 'none' }} />
        <div className="qd-header-contact">
          {contactLines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </div>

      {/* Document body */}
      <div className="quote-document" ref={ref}>

        {/* Sections */}
        {sectionKeys.map(key => (
          <div key={key} className="qd-section">
            {editMode && (
              <div className="qd-section-edit-label">{labels[key]}</div>
            )}
            {editMode ? (
              <textarea
                className="qd-textarea"
                value={sections[key] || ''}
                ref={el => autoResize(el)}
                onInput={e => autoResize(e.target)}
                onChange={e => { autoResize(e.target); onChange && onChange(key, e.target.value) }}
              />
            ) : key === 'clientInfo' ? (
              <div className="qd-text">
                {(() => {
                  const text = sections[key] || ''
                  const newlineIdx = text.indexOf('\n')
                  const firstLine = newlineIdx >= 0 ? text.slice(0, newlineIdx) : text
                  const rest      = newlineIdx >= 0 ? text.slice(newlineIdx) : ''
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <div className="qd-line">{firstLine}</div>
                        {quoteNumber && <div className="qd-line" style={{ fontWeight: 600 }}>{quoteNumber}</div>}
                      </div>
                      {renderFormattedText(rest)}
                    </>
                  )
                })()}
              </div>
            ) : (
              <div className="qd-text">{renderFormattedText(sections[key] || '')}</div>
            )}
          </div>
        ))}

        {/* Signature footer */}
        <div style={{ marginTop: 40 }}>
          {(signatureDataUrl || creator?.signatureImageUrl) && (
            <img
              src={signatureDataUrl || creator.signatureImageUrl}
              alt=""
              style={{ display: 'block', height: 60, maxWidth: 220, objectFit: 'contain', marginBottom: 8 }}
            />
          )}
          {creator?.emailSignature ? (
            <div style={{ fontSize: 12.5, whiteSpace: 'pre-line', lineHeight: 1.6 }}>
              {creator.emailSignature}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600 }}>WinMovers International</div>
              {contactLines.slice(0, 3).map((line, i) => <div key={i}>{line}</div>)}
            </div>
          )}
        </div>

        {/* Certifications banner — end of quote only */}
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <img
            src="/certifications-banner.png"
            alt="AMSA · lacma · IAM · FIDI · FAIM Plus"
            style={{ width: '100%', height: 110, objectFit: 'cover', objectPosition: 'center', display: 'block' }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        </div>
      </div>

      {/* Page footer — contact info repeated on every PDF page */}
      <div ref={footerRef} style={{ borderTop: '1px solid #e2e8f0', paddingTop: 8, paddingBottom: 4, textAlign: 'center', backgroundColor: '#ffffff' }}>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7 }}>
          Tel (506) 2215 3536 &nbsp;·&nbsp; Fax (506) 2215 3530 &nbsp;·&nbsp; sales@winmovers.com
        </div>
        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7 }}>
          Escazú, 800 mts norte Multiplaza · Complejo Attica Bodega 10, San José, Costa Rica
        </div>
      </div>
    </div>
  )
})

export default QuoteDocument
