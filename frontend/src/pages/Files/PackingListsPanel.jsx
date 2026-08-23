import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

function statusBadge(status, t) {
  const map = {
    ACTIVE: { bg: '#e8f0fe', color: '#1a73e8', label: t('packingLists.statusActive') },
    COMPLETE_PENDING_SYNC: { bg: '#fff3cd', color: '#8a6d1f', label: t('packingLists.statusPending') },
    CLOSED: { bg: '#e6f4ea', color: '#1e8e3e', label: t('packingLists.statusClosed') },
    ERROR: { bg: '#fce8e6', color: '#c5221f', label: 'Error' },
  }
  const m = map[status] ?? { bg: '#f1f3f4', color: '#5f6368', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      background: m.bg, color: m.color, fontSize: 11, fontWeight: 700,
    }}>
      {m.label}
    </span>
  )
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`
}

export default function PackingListsPanel({ fileId }) {
  const { t, lang } = useLanguage()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [detail, setDetail] = useState({})
  const [loadingDetail, setLoadingDetail] = useState({})
  const [deleting, setDeleting] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)

  const loadLists = async () => {
    if (!fileId) return
    setLoading(true)
    setError(null)
    try {
      const data = await api.get(`/packing-lists?movingFileId=${fileId}`)
      setLists(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLists()
  }, [fileId])

  const deleteList = async (listId, listNumber) => {
    if (!window.confirm(t('packingLists.deleteConfirm', { listNumber }))) return
    setDeleting(listId)
    try {
      await api.patch(`/packing-lists/${listId}/soft-delete`, {})
      await loadLists()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  const toggleExpand = async (listId) => {
    if (expanded === listId) { setExpanded(null); return }
    setExpanded(listId)
    if (!detail[listId]) {
      setLoadingDetail(d => ({ ...d, [listId]: true }))
      try {
        const data = await api.get(`/packing-lists/${listId}`)
        setDetail(d => ({ ...d, [listId]: data }))
      } finally {
        setLoadingDetail(d => ({ ...d, [listId]: false }))
      }
    }
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>{t('packingLists.loading')}</div>
  if (error) return <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
  if (lists.length === 0) return <div style={{ padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>{t('packingLists.empty')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lists.map(list => {
        const isOpen = expanded === list.id
        const d = detail[list.id]
        return (
          <div key={list.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {/* Header row */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleExpand(list.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleExpand(list.id)
                }
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: isOpen ? '#f8f9ff' : '#fff',
                border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{list.listNumber}</span>
                {statusBadge(list.status, t)}
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {t('packingLists.boxes', { count: list.packageCount })}
                </span>
                {list.syncVisibilityState === 'SYNC_IN_PROGRESS' && (
                  <span style={{ fontSize: 12, color: '#8a6d1f', background: '#fff3cd', borderRadius: 12, padding: '2px 8px', fontWeight: 700 }}>
                    {t('packingLists.syncInProgress')}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>{list.operatorName}</span>
                <span>{fmtDateTime(list.updatedAt)}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteList(list.id, list.listNumber)
                  }}
                  disabled={deleting === list.id}
                  style={{ border: 'none', background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                >
                  {deleting === list.id ? t('packingLists.deleting') : t('packingLists.delete')}
                </button>
                <span style={{ fontSize: 16 }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ padding: '0 16px 16px', background: '#fafbff', borderTop: '1px solid var(--border)' }}>
                {loadingDetail[list.id] && (
                  <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>Cargando detalle…</div>
                )}
                {d && d.packages && (
                  <div style={{ marginTop: 12 }}>
                    {d.packages.length === 0 && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('packingLists.noBoxes')}</p>
                    )}
                    {d.packages.map((pkg, idx) => (
                      <div key={pkg.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>Bulto {idx + 1}</span>
                          <code style={{ fontSize: 12, background: '#f1f3f4', borderRadius: 4, padding: '1px 6px' }}>{pkg.barcode}</code>
                        </div>
                        {pkg.items.length > 0 && (
                          <ul style={{ margin: '0 0 6px 16px', padding: 0, fontSize: 13, color: '#333' }}>
                            {pkg.items.map(item => (
                              <li key={item.id}>
                                {item.customName || item.packingItemType?.[lang === 'en' ? 'nameEn' : 'nameEs'] || item.packingItemTypeId || '—'}
                                {' ×'}{item.quantity}
                                {item.note ? <em style={{ color: '#888', fontSize: 11 }}> ({item.note})</em> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                        {pkg.photos.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                              📷 {pkg.photos.length} foto{pkg.photos.length !== 1 ? 's' : ''}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {pkg.photos.map(photo => (
                                <button
                                  key={photo.id}
                                  type="button"
                                  onClick={() => {
                                    if (photo.downloadUrl) setSelectedImage(photo.downloadUrl)
                                  }}
                                  style={{
                                    width: 70,
                                    height: 70,
                                    borderRadius: 6,
                                    overflow: 'hidden',
                                    border: '1px solid var(--border)',
                                    background: '#f1f3f4',
                                    padding: 0,
                                    cursor: photo.downloadUrl ? 'zoom-in' : 'default',
                                  }}
                                  disabled={!photo.downloadUrl}
                                  title={photo.downloadUrl ? 'Abrir imagen' : 'Imagen no disponible'}
                                >
                                  {photo.downloadUrl ? (
                                    <img
                                      src={photo.downloadUrl}
                                      alt="Foto de bulto"
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <span style={{ fontSize: 10, color: '#666' }}>Sin vista</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {d && (
                  <div style={{ marginTop: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 8 }}>Firma del cliente</div>
                    {d.signatureDeclined ? (
                      <div style={{ fontSize: 13, color: '#666' }}>
                        <div>Cliente no firmó esta lista.</div>
                        {d.signatureDeclineNote ? <div style={{ marginTop: 6 }}>Motivo: {d.signatureDeclineNote}</div> : null}
                      </div>
                    ) : d.signatureUrl ? (
                      <button
                        type="button"
                        onClick={() => setSelectedImage(d.signatureUrl)}
                        style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'zoom-in' }}
                        title="Abrir firma"
                      >
                        <img
                          src={d.signatureUrl}
                          alt="Firma del cliente"
                          style={{ display: 'block', width: '100%', maxWidth: 360, height: 120, objectFit: 'contain', background: '#f7f8fa', border: '1px solid var(--border)', borderRadius: 8 }}
                        />
                      </button>
                    ) : (
                      <div style={{ fontSize: 13, color: '#666' }}>Firma no disponible.</div>
                    )}
                  </div>
                )}
                {d && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 24 }}>
                    <span>Creado: {fmtDateTime(d.createdAt)}</span>
                    <span>Actualizado: {fmtDateTime(d.updatedAt)}</span>
                    {d.lockedByDeviceId && <span>🔒 {d.lockedByDeviceId.slice(0, 8)}…</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', maxWidth: '90vw', maxHeight: '90vh' }}
          >
            <img
              src={selectedImage}
              alt="Foto ampliada"
              style={{ display: 'block', maxWidth: '90vw', maxHeight: '82vh', objectFit: 'contain', background: '#fff' }}
            />
            <div style={{ padding: 10, background: '#f7f8fa', textAlign: 'right', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                style={{ border: 'none', background: '#2563eb', color: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
