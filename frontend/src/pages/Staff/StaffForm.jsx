import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

// Map Azure AD App Role value → StaffMember role
const AD_ROLE_MAP = { Admin: 'ADMIN', Coordinator: 'COORDINATOR' }

const EMPTY = {
  name: '', email: '', phone: '', isActive: true,
  canBeAssignedToVisit: true, canCreateQuotes: false, canBeCreatorInWorkOrder: false, canCoordinateFiles: false,
  role: '', azureOid: '',
}

export default function StaffForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const { t } = useLanguage()

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const errorRef = useRef(null)

  // Azure AD user search state
  const [adQuery, setAdQuery] = useState('')
  const [adResults, setAdResults] = useState([])
  const [adSearching, setAdSearching] = useState(false)
  const [adSearched, setAdSearched] = useState(false)
  const adTimer = useRef(null)
  const adDropdownRef = useRef(null)

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  useEffect(() => {
    if (!isEdit) return
    api.get(`/staff/${id}`)
      .then(m => setForm({
        name: m.name, email: m.email, phone: m.phone || '', isActive: m.isActive,
        canBeAssignedToVisit:    m.canBeAssignedToVisit,
        canCreateQuotes:         m.canCreateQuotes,
        canBeCreatorInWorkOrder: m.canBeCreatorInWorkOrder,
        canCoordinateFiles:      m.canCoordinateFiles,
        role: m.role || '',
        azureOid: m.azureOid || '',
      }))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  // ── Azure AD user search ─────────────────────────────────────────────────
  const handleAdQueryChange = (val) => {
    setAdQuery(val)
    setAdSearched(false)
    clearTimeout(adTimer.current)
    if (val.trim().length < 2) { setAdResults([]); return }
    adTimer.current = setTimeout(async () => {
      setAdSearching(true)
      try {
        const results = await api.get(`/staff/azure-users?q=${encodeURIComponent(val.trim())}`)
        setAdResults(results)
        setAdSearched(true)
      } catch (err) {
        setError(err.message)
        setAdResults([])
      } finally { setAdSearching(false) }
    }, 400)
  }

  const selectAdUser = (user) => {
    const mappedRole = AD_ROLE_MAP[user.adRole] || ''
    setForm(prev => ({
      ...prev,
      name:     user.displayName,
      email:    user.email,
      azureOid: user.id,
      role:     mappedRole || prev.role,
    }))
    setAdQuery(user.displayName)
    setAdResults([])
    setAdSearched(false)
  }

  const clearAdLink = () => {
    setForm(prev => ({ ...prev, azureOid: '' }))
    setAdQuery('')
    setAdResults([])
    setAdSearched(false)
  }

  const field = (name, type = 'text') => ({
    type,
    className: 'form-control',
    value: form[name],
    onChange: e => set(name, e.target.value),
  })

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('staff.name') + ' is required.'); return }
    if (!form.email.trim()) { setError(t('staff.email') + ' is required.'); return }
    setSaving(true); setError(null)
    try {
      if (isEdit) {
        await api.put(`/staff/${id}`, form)
        navigate('/staff')
      } else {
        await api.post('/staff', form)
        navigate('/staff')
      }    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /> {t('common.loading')}</div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isEdit ? t('staff.editStaffMember') : t('staff.newStaffMember')}
            {isEdit && !loading && (
              <span className="badge" style={{
                fontSize: 12, fontWeight: 500, verticalAlign: 'middle',
                background: form.isActive ? '#dcfce7' : '#f1f5f9',
                color: form.isActive ? '#16a34a' : '#64748b',
              }}>
                {form.isActive ? t('staff.isActive') : t('staff.inactive')}
              </span>
            )}
          </div>
          <div className="page-subtitle">{t('staff.subtitle')}</div>
        </div>
        <Link to="/staff" className="btn btn-secondary">{t('common.cancel')}</Link>
      </div>

      {error && (
        <div ref={errorRef} className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── Azure AD account link ────────────────────────────────── */}
        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('staff.azureSection')}</div>

          {form.azureOid ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#dcfce7', color: '#16a34a',
                borderRadius: 6, padding: '4px 10px', fontSize: 13,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {t('staff.azureLinked')}: {form.email}
              </span>
              <button type="button" className="btn btn-secondary" style={{ fontSize: 12, padding: '3px 10px' }} onClick={clearAdLink}>
                {t('staff.azureUnlink')}
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative', marginTop: 8 }} ref={adDropdownRef}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t('staff.azureSearch')}
                  value={adQuery}
                  onChange={e => handleAdQueryChange(e.target.value)}
                  style={{ paddingRight: 32 }}
                />
                {adSearching && (
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)' }}>
                    ⏳
                  </span>
                )}
              </div>

              {(adResults.length > 0 || (adSearched && !adSearching && adResults.length === 0)) && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: '#fff', border: '1px solid var(--border)', borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4, overflow: 'hidden',
                }}>
                  {adResults.length === 0 ? (
                    <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                      {t('staff.azureNoResults')}
                    </div>
                  ) : adResults.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => selectAdUser(user)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '8px 14px',
                        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                        borderBottom: '1px solid var(--border)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--primary)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {user.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{user.displayName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                      </div>
                      {user.adRole && (
                        <span style={{
                          flexShrink: 0, fontSize: 11, padding: '2px 7px', borderRadius: 4,
                          background: user.adRole === 'Admin' ? '#fef9c3' : '#eff6ff',
                          color: user.adRole === 'Admin' ? '#854d0e' : '#1d4ed8',
                        }}>
                          {user.adRole}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('staff.title')}</div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">{t('staff.name')} <span style={{ color: '#ef4444' }}>*</span></label>
              <input {...field('name')} placeholder={t('staff.namePlaceholder')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('staff.email')} <span style={{ color: '#ef4444' }}>*</span></label>
              <input {...field('email', 'email')} placeholder={t('staff.emailPlaceholder')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('staff.phone')}</label>
              <input {...field('phone', 'tel')} placeholder={t('staff.phonePlaceholder')} />
            </div>
          </div>
        </div>

        <div className="card card-body" style={{ marginBottom: 16 }}>
          <div className="section-label">{t('staff.permissionsSection')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {[
              ['canBeAssignedToVisit',    t('staff.canBeAssignedToVisit')],
              ['canCreateQuotes',         t('staff.canCreateQuotes')],
              ['canBeCreatorInWorkOrder', t('staff.canBeCreatorInWorkOrder')],
              ['canCoordinateFiles',      t('staff.canCoordinateFiles')],
            ].map(([key, label]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={e => set(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="form-group" style={{ marginTop: 16, maxWidth: 240 }}>
            <label className="form-label">{t('staff.role')}</label>
            <select className="form-control" value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="">{t('staff.roleNone')}</option>
              <option value="ADMIN">{t('staff.roleAdmin')}</option>
              <option value="COORDINATOR">{t('staff.roleCoordinator')}</option>
              <option value="STAFF">{t('staff.roleStaff')}</option>
            </select>
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : isEdit ? t('staff.saveStaffMember') : t('staff.createStaffMember')}
          </button>
          <Link to="/staff" className="btn btn-secondary">{t('common.cancel')}</Link>
        </div>
      </form>
    </>
  )
}
