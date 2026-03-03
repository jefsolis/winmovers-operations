import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

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
                  <th>{t('staff.isActive')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td style={{ fontSize: 13 }}>{m.email}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.phone || '—'}</td>
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
