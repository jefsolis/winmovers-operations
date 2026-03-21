import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { CURRENCIES } from '../../constants'
import { useLanguage } from '../../i18n'
import QuoteDocument from './QuoteDocument'
import { buildDefaultSections, SERVICE_TYPE_LABELS, SECTION_KEYS, LOCAL_SECTION_KEYS, priceToWords } from './quoteTemplates'

const daysFromNow = (n) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const EMPTY_META = {
  totalAmount: '', currency: 'USD', validUntil: '', creatorName: '', status: 'DRAFT',
}

const EMPTY_VARS = { clientName: '', company: '', origin: '', destiny: '', serviceType: '' }

function extractVarsFromVisit(visitData, lang) {
  const l = lang === 'ES' ? 'ES' : 'EN'
  return {
    clientName:  visitData?.client
      ? (`${visitData.client.firstName || ''} ${visitData.client.lastName || ''}`.trim() || visitData.client.name || '')
      : (visitData?.prospectName || ''),
    company:     visitData?.corporateClient?.name || '',
    origin:      [visitData?.originAddress, visitData?.originCity, visitData?.originCountry].filter(Boolean).join(', '),
    destiny:     [visitData?.destAddress,   visitData?.destCity,   visitData?.destCountry  ].filter(Boolean).join(', '),
    serviceType: SERVICE_TYPE_LABELS[l]?.[visitData?.serviceType] || visitData?.serviceType || '',
  }
}

export default function QuoteForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { t } = useLanguage()

  const [language, setLanguage]           = useState('EN')
  const [meta, setMeta]                   = useState({ ...EMPTY_META, validUntil: daysFromNow(30) })
  const [vars, setVars]                   = useState({ ...EMPTY_VARS })
  const [sections, setSections]           = useState({})
  const [visitId, setVisitId]             = useState(searchParams.get('visitId') || '')
  const [visit, setVisit]                 = useState(null)
  const [rawServiceType, setRawServiceType] = useState('')
  const [quoteNumber, setQuoteNumber]     = useState('')
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)
  const [staffMembers, setStaffMembers]   = useState([])
  const errorRef = useRef(null)

  useEffect(() => { api.get('/staff?canCreateQuotes=true').then(setStaffMembers).catch(() => {}) }, [])

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  const buildTplVars = (lang, currentVars, currentMeta) => {
    const l = lang === 'ES' ? 'ES' : 'EN'
    const locale = l === 'ES' ? 'es-CR' : 'en-GB'
    const dateOpts = { day: '2-digit', month: 'long', year: 'numeric' }
    const validUntilStr = currentMeta?.validUntil
      ? new Date(currentMeta.validUntil).toLocaleDateString(locale, dateOpts)
      : ''
    return {
      date:        new Date().toLocaleDateString(locale, dateOpts),
      clientName:  currentVars?.clientName  || '',
      company:     currentVars?.company     || '',
      origin:      currentVars?.origin      || '',
      destiny:     currentVars?.destiny     || '',
      serviceType: currentVars?.serviceType || '',
      currency:    currentMeta?.currency    || 'USD',
      price:       currentMeta?.totalAmount || '',
      priceInWords: priceToWords(currentMeta?.totalAmount, l, currentMeta?.currency),
      validUntil:  validUntilStr,
      creatorName: currentMeta?.creatorName || '',
    }
  }

  const rebuildSections = (lang, currentVars, currentMeta, rawST) => {
    setSections(buildDefaultSections(lang, buildTplVars(lang, currentVars, currentMeta), rawST))
  }

  useEffect(() => {
    if (isEdit) {
      api.get(`/quotes/${id}`)
        .then(q => {
          const lang = q.language || 'EN'
          setLanguage(lang)
          setQuoteNumber(q.quoteNumber)
          setVisitId(q.visitId)
          const m = {
            totalAmount: q.totalAmount ?? '',
            currency:    q.currency || 'USD',
            validUntil:  q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : '',
            creatorName: q.creatorName || '',
            status:      q.status,
          }
          setMeta(m)
          const v = extractVarsFromVisit(q.visit, lang)
          setVars(v)
          if (q.visit) setVisit(q.visit)
          const rawST = q.visit?.serviceType || ''
          setRawServiceType(rawST)
          if (q.content) {
            try { setSections(JSON.parse(q.content)) } catch { rebuildSections(lang, v, m, rawST) }
          } else {
            rebuildSections(lang, v, m, rawST)
          }
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    } else {
      const vid = searchParams.get('visitId') || ''
      if (vid) {
        const initMeta = { ...EMPTY_META, validUntil: daysFromNow(30) }
        api.get(`/visits/${vid}`)
          .then(v => {
            setVisit(v)
            const lang = v.language || 'EN'
            setLanguage(lang)
            const rawST = v.serviceType || ''
            setRawServiceType(rawST)
            const initVars = extractVarsFromVisit(v, lang)
            setVars(initVars)
            const metaWithCreator = { ...initMeta, creatorName: v.assignedTo?.name || '' }
            setMeta(metaWithCreator)
            rebuildSections(lang, initVars, metaWithCreator, rawST)
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      } else {
        rebuildSections('EN', vars, meta, '')
        setLoading(false)
      }
    }
  }, [id]) // eslint-disable-line

  const setMetaField = (field, value) => setMeta(prev => ({ ...prev, [field]: value }))
  const setVarField  = (field, value) => setVars(prev => ({ ...prev, [field]: value }))

  const handleLanguageChange = (lang) => {
    setLanguage(lang)
    const newVars = { ...vars }
    if (visit?.serviceType) {
      newVars.serviceType = SERVICE_TYPE_LABELS[lang]?.[visit.serviceType] || vars.serviceType
    }
    setVars(newVars)
    if (!isEdit) rebuildSections(lang, newVars, meta, rawServiceType)
  }

  const handleSubmit = async () => {
    if (!visitId) { setError(t('quotes.visitRequired')); return }
    setSaving(true); setError(null)
    try {
      const payload = {
        visitId,
        status:      meta.status || 'DRAFT',
        totalAmount: meta.totalAmount !== '' ? parseFloat(meta.totalAmount) : null,
        currency:    meta.currency || 'USD',
        validUntil:  meta.validUntil || null,
        creatorName: meta.creatorName || null,
        language,
        content:     JSON.stringify(sections),
      }
      if (isEdit) {
        await api.put(`/quotes/${id}`, payload)
        navigate(`/quotes/${id}`)
      } else {
        const created = await api.post('/quotes', payload)
        navigate(`/quotes/${created.id}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  const visitLabel = visit?.client?.name || visit?.prospectName || visit?.visitNumber || visitId

  return (
    <div>
      {/* Sticky toolbar */}
      <div className="page-header quote-editor-toolbar">
        <div>
          <div className="page-title" style={{ fontSize: 16 }}>
            {isEdit ? `${t('common.edit')} — ${quoteNumber}` : t('quotes.newQuoteTitle')}
          </div>
          {visitLabel && (
            <div className="page-subtitle">{t('quotes.linkedVisit')}: {visitLabel}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="lang-toggle">
            <button type="button"
              className={`lang-toggle-btn${language === 'EN' ? ' active' : ''}`}
              onClick={() => handleLanguageChange('EN')}>EN</button>
            <button type="button"
              className={`lang-toggle-btn${language === 'ES' ? ' active' : ''}`}
              onClick={() => handleLanguageChange('ES')}>ES</button>
          </div>
          <Link
            to={isEdit ? `/quotes/${id}` : (visitId ? `/visits/${visitId}` : '/quotes')}
            className="btn btn-secondary btn-sm"
          >{t('common.cancel')}</Link>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {error && (
        <div ref={errorRef} className="alert alert-error" style={{ margin: '12px 0' }}>{error}</div>
      )}

      {/* Template variables strip */}
      <div className="card card-body quote-meta-strip" style={{ marginTop: 12 }}>
        <div style={{ width: '100%', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)' }}>
            {t('quotes.tplVars')}
          </span>
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
          <label className="form-label">{t('quotes.tplClientName')}</label>
          <input type="text" className="form-control"
            value={vars.clientName} onChange={e => setVarField('clientName', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
          <label className="form-label">{t('quotes.tplCompany')}</label>
          <input type="text" className="form-control"
            value={vars.company} onChange={e => setVarField('company', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
          <label className="form-label">{t('quotes.tplOrigin')}</label>
          <input type="text" className="form-control"
            value={vars.origin} onChange={e => setVarField('origin', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
          <label className="form-label">{t('quotes.tplDestiny')}</label>
          <input type="text" className="form-control"
            value={vars.destiny} onChange={e => setVarField('destiny', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 170 }}>
          <label className="form-label">{t('quotes.tplServiceType')}</label>
          <select className="form-control" value={vars.serviceType} onChange={e => setVarField('serviceType', e.target.value)}>
            <option value="">—</option>
            {Object.values(SERVICE_TYPE_LABELS[language] || SERVICE_TYPE_LABELS.EN).map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Meta fields strip */}
      <div className="card card-body quote-meta-strip" style={{ marginTop: 0, borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
        <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
          <label className="form-label">{t('quotes.totalAmount')}</label>
          <input type="number" min="0" step="0.01" className="form-control"
            value={meta.totalAmount} onChange={e => setMetaField('totalAmount', e.target.value)}
            placeholder="0.00" />
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 90 }}>
          <label className="form-label">{t('quotes.currency')}</label>
          <select className="form-control" value={meta.currency} onChange={e => setMetaField('currency', e.target.value)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
          <label className="form-label">{t('quotes.validUntil')}</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="date" className="form-control" style={{ flex: 1 }}
              value={meta.validUntil} onChange={e => setMetaField('validUntil', e.target.value)} />
            {[30, 60, 90].map(n => (
              <button key={n} type="button" className="btn btn-secondary btn-sm"
                onClick={() => setMetaField('validUntil', daysFromNow(n))}>+{n}d</button>
            ))}
          </div>
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 180 }}>
          <label className="form-label">{t('quotes.creatorName')}</label>
          {staffMembers.length > 0 ? (
            <select className="form-control"
              value={meta.creatorName} onChange={e => setMetaField('creatorName', e.target.value)}>
              <option value="">—</option>
              {staffMembers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          ) : (
            <input type="text" className="form-control"
              value={meta.creatorName} onChange={e => setMetaField('creatorName', e.target.value)}
              placeholder={t('quotes.creatorPlaceholder')} />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" className="btn btn-secondary btn-sm"
            title={t('quotes.refreshTemplate')}
            onClick={() => rebuildSections(language, vars, meta, rawServiceType)}>
            ↺ {t('quotes.refreshTemplate')}
          </button>
        </div>
      </div>

      {/* Document editor */}
      <div className="quote-document-wrapper">
        <QuoteDocument
          sections={sections}
          editMode={true}
          onChange={(key, val) => setSections(prev => ({ ...prev, [key]: val }))}
          language={language}
          quoteNumber={quoteNumber || t('quotes.newQuoteTitle')}
          sectionKeys={rawServiceType === 'LOCAL_MOVE' ? LOCAL_SECTION_KEYS : SECTION_KEYS}
        />
      </div>
    </div>
  )
}
