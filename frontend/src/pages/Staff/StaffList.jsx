import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

const PERMISSIONS = [
  { key: 'canBeAssignedToVisit',    bg: '#ede9fe', color: '#7c3aed', labelKey: 'nav.visits'  },
  { key: 'canCreateQuotes',         bg: '#e0f2fe', color: '#0369a1', labelKey: 'nav.quotes'  },
  { key: 'canBeCreatorInWorkOrder', bg: '#fef9c3', color: '#a16207', labelKey: 'nav.jobs'    },
  { key: 'canCoordinateFiles',      bg: '#dcfce7', color: '#15803d', labelKey: 'nav.files'   },
]

const ROLE_META = {
  ADMIN:       { bg: '#fee2e2', color: '#b91c1c' },
  COORDINATOR: { bg: '#fce7f3', color: '#be185d' },
  STAFF:       { bg: '#f1f5f9', color: '#475569' },
}

export default function StaffList() {
  const { t } = useLanguage()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(false)

  const load = () => {
    setLoading(true)
    api.get(`/staff${includeInactive ? '?includeInactive=true' : ''}`)
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [includeInactive]) // eslint-disable-line

  const handleDelete = async (member) => {
    if (!window.confirm(t('staff.deleteConfirm').replace('{{name}}', member.name))) return
    await api.delete(`/staff/${member.id}`)
    load()
  }

  const handleToggleActive = async (member) => {
    await api.put(`/staff/${member.id}`, { ...member, isActive: !member.isActive })
    load()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('staff.title')}</div>
          <div className="page-subtitle">{t('staff.subtitle')}</div>
        </div>
        <Link to="/staff/new" className="btn btn-primary">{t('staff.newStaffMember')}</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={e => setIncludeInactive(e.target.checked)}
            />
            {t('staff.inactive')}
          </label>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /> {t('common.loading')}</div>
      ) : members.length === 0 ? (
        <div className="card card-body" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👷</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('staff.empty')}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{t('staff.emptyHint')}</div>
          <Link to="/staff/new" className="btn btn-primary" style={{ display: 'inline-block' }}>{t('staff.newStaffMember')}</Link>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('staff.name')}</th>
                  <th>{t('staff.email')}</th>
                  <th>{t('staff.phone')}</th>
                  <th>{t('staff.permissions')}</th>
                  <th>{t('staff.isActive')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      {m.role && (
                        <span
                          className="badge"
                          style={{
                            background: ROLE_META[m.role]?.bg ?? '#f1f5f9',
                            color: ROLE_META[m.role]?.color ?? '#475569',
                            fontSize: 11,
                            marginTop: 2,
                          }}
                        >
                          {m.role}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>{m.email}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.phone || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {PERMISSIONS.filter(p => m[p.key]).map(p => (
                          <span
                            key={p.key}
                            title={t(`staff.${p.key}`)}
                            className="badge"
                            style={{ background: p.bg, color: p.color, fontSize: 11 }}
                          >
                            {t(p.labelKey)}
                          </span>
                        ))}
                        {!PERMISSIONS.some(p => m[p.key]) && (
                          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: m.isActive ? '#dcfce7' : '#f1f5f9',
                          color: m.isActive ? '#16a34a' : '#64748b',
                        }}
                      >
                        {m.isActive ? t('staff.isActive') : t('staff.inactive')}
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleToggleActive(m)}
                      >
                        {m.isActive ? t('staff.deactivate') : t('staff.activate')}
                      </button>
                      <Link to={`/staff/${m.id}/edit`} className="btn btn-secondary btn-sm">{t('common.edit')}</Link>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m)}>{t('common.delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
