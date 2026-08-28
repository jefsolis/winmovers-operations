import { useCallback, useEffect, useState } from 'react'
import {
  ChevronDown, ChevronUp, History, Image, LockKeyhole, MapPin, MapPinOff, Signature,
  Star, Trash2, X,
} from 'lucide-react'
import { api } from '../../api'
import { googleMapsUrl, packingProgressMeta } from '../../constants'
import { useLanguage } from '../../i18n'

const POLL_INTERVAL_MS = 10_000

function statusBadge(status, t) {
  const map = {
    ACTIVE: { bg: '#e8f0fe', color: '#1a73e8', label: t('packingLists.statusActive') },
    COMPLETE_PENDING_SYNC: { bg: '#fff3cd', color: '#8a6d1f', label: t('packingLists.statusPending') },
    CLOSED: { bg: '#e6f4ea', color: '#1e8e3e', label: t('packingLists.statusClosed') },
    ERROR: { bg: '#fce8e6', color: '#c5221f', label: t('packingLists.statusError') },
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

function fmtDate(iso) {
  if (!iso) return '—'
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

function packageLocationInfo(d) {
  const completedOps = (d?.ingressEgressOperations || [])
    .filter(op => op.status === 'COMPLETE' && op.completedAt)
    .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
  const latest = completedOps[0]
  if (!latest) {
    return { location: 'AT_CLIENT', since: d?.completionConfirmedAt || d?.createdAt || null }
  }
  const location = latest.type === 'INGRESS_WAREHOUSE' ? 'AT_WAREHOUSE' : 'AT_TRUCK'
  return { location, since: latest.completedAt }
}

function ProgressBadge({ status, t }) {
  const meta = packingProgressMeta(status || 'NOT_STARTED', t)
  const Icon = meta.Icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 12,
      background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 700,
    }}>
      <Icon size={13} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

function TransitionSummary({ transition, t }) {
  if (!transition) return null
  const from = packingProgressMeta(transition.fromStatus, t)
  const to = packingProgressMeta(transition.toStatus, t)
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
      <History size={14} aria-hidden="true" />
      <span style={{ fontWeight: 700 }}>{t('packingLists.latestTransition')}:</span>
      <span>{from.label}</span>
      <span aria-hidden="true">→</span>
      <span>{to.label}</span>
      <span>{t('packingLists.transitionMeta', {
        actor: transition.actorName || '—',
        date: fmtDateTime(transition.confirmedAt || transition.occurredAt),
      })}</span>
    </div>
  )
}

function SignaturePreview({ src, alt, openLabel, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen({ src, alt })}
      style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'zoom-in' }}
      title={openLabel}
    >
      <img
        src={src}
        alt={alt}
        style={{ display: 'block', width: '100%', maxWidth: 360, height: 120, objectFit: 'contain', background: '#f7f8fa', border: '1px solid var(--border)', borderRadius: 8 }}
      />
    </button>
  )
}

function LocationIndicator({ location, eventLabel, t }) {
  if (!location) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
        <MapPinOff size={13} aria-hidden="true" />
        {t('packingLists.locationNotCaptured')}
      </span>
    )
  }

  const hasCoordinates = location.latitude != null && location.longitude != null
  if (!hasCoordinates) {
    const reason = location.unavailableReason
      ? t(`packingLists.locationReason.${location.unavailableReason}`)
      : t('packingLists.locationUnavailable')
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#8a6d1f' }}>
        <MapPinOff size={13} aria-hidden="true" />
        {t('packingLists.locationUnavailable')}: {reason}
      </span>
    )
  }

  const label = `${t('packingLists.openLocation')} — ${eventLabel}`
  return (
    <a
      href={googleMapsUrl(location.latitude, location.longitude)}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#1a73e8', fontWeight: 700, textDecoration: 'none' }}
    >
      <MapPin size={13} aria-hidden="true" />
      {t('packingLists.location')}
    </a>
  )
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
  const [historyOpen, setHistoryOpen] = useState({})

  const loadLists = useCallback(async (background = false) => {
    if (!fileId) return
    if (!background) {
      setLoading(true)
      setError(null)
    }
    try {
      const data = await api.get(`/packing-lists?movingFileId=${fileId}`)
      setLists(data)
    } catch (e) {
      if (!background) setError(e.message)
    } finally {
      if (!background) setLoading(false)
    }
  }, [fileId])

  const loadDetail = useCallback(async (listId, background = false) => {
    if (!background) setLoadingDetail(current => ({ ...current, [listId]: true }))
    try {
      const data = await api.get(`/packing-lists/${listId}`)
      setDetail(current => ({ ...current, [listId]: data }))
    } catch {
      // Keep the last confirmed detail visible during transient refresh failures.
    } finally {
      if (!background) setLoadingDetail(current => ({ ...current, [listId]: false }))
    }
  }, [])

  useEffect(() => {
    loadLists()
  }, [loadLists])

  useEffect(() => {
    let intervalId = null

    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      loadLists(true)
      if (expanded) loadDetail(expanded, true)
    }
    const schedulePolling = () => {
      if (intervalId) window.clearInterval(intervalId)
      intervalId = document.visibilityState === 'visible'
        ? window.setInterval(refresh, POLL_INTERVAL_MS)
        : null
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
      schedulePolling()
    }

    schedulePolling()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (intervalId) window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [expanded, loadDetail, loadLists])

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
    if (!detail[listId]) loadDetail(listId)
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{list.listNumber}</span>
                  {statusBadge(list.status, t)}
                  <ProgressBadge status={list.progressStatus} t={t} />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {t('packingLists.boxes', { count: list.packageCount })}
                  </span>
                  {list.syncVisibilityState === 'SYNC_IN_PROGRESS' && (
                    <span style={{ fontSize: 12, color: '#8a6d1f', background: '#fff3cd', borderRadius: 12, padding: '2px 8px', fontWeight: 700 }}>
                      {t('packingLists.syncInProgress')}
                    </span>
                  )}
                </div>
                <TransitionSummary transition={list.latestTransition} t={t} />
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
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: '#fee2e2', color: '#991b1b', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  {deleting === list.id ? t('packingLists.deleting') : t('packingLists.delete')}
                </button>
                {isOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              </div>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ padding: '0 16px 16px', background: '#fafbff', borderTop: '1px solid var(--border)' }}>
                {loadingDetail[list.id] && (
                  <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>{t('packingLists.loadingDetail')}</div>
                )}
                {d && d.progressStatus === 'COMPLETED' && (() => {
                  const packageLocation = packageLocationInfo(d)
                  return (
                    <div style={{
                      marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
                      background: '#e8f0fe', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#1a73e8',
                    }}>
                      <MapPin size={16} aria-hidden="true" />
                      {t('packingLists.packageLocation.message', {
                        location: t(`packingLists.packageLocation.${packageLocation.location}`),
                        date: packageLocation.since ? fmtDate(packageLocation.since) : '—',
                      })}
                    </div>
                  )
                })()}
                {d && d.packages && (
                  <div style={{ marginTop: 12 }}>
                    {d.packages.length === 0 && (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('packingLists.noBoxes')}</p>
                    )}
                    {d.packages.map((pkg, idx) => (
                      <div key={pkg.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{t('packingLists.boxNumber', { number: idx + 1 })}</span>
                          <code style={{ fontSize: 12, background: '#f1f3f4', borderRadius: 4, padding: '1px 6px' }}>{pkg.barcode || 'SIN-CODIGO'}</code>
                        </div>
                        {(pkg.barcodeState === 'MISSING' || !pkg.barcode) && (
                          <div style={{ marginBottom: 8, fontSize: 11, color: '#b45309', fontWeight: 700 }}>
                            {t('packingLists.barcodeStates.MISSING')}
                          </div>
                        )}
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                              <Image size={14} aria-hidden="true" />
                              {t('packingLists.photos', { count: pkg.photos.length })}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {pkg.photos.map(photo => (
                                <button
                                  key={photo.id}
                                  type="button"
                                  onClick={() => {
                                    if (photo.downloadUrl) setSelectedImage({
                                      src: photo.downloadUrl,
                                      alt: t('packingLists.packagePhotoAlt'),
                                    })
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
                                  title={photo.downloadUrl ? t('packingLists.openImage') : t('packingLists.imageUnavailable')}
                                >
                                  {photo.downloadUrl ? (
                                    <img
                                      src={photo.downloadUrl}
                                      alt={t('packingLists.packagePhotoAlt')}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    <span style={{ fontSize: 10, color: '#666' }}>{t('packingLists.noPreview')}</span>
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
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(prev => ({ ...prev, [list.id]: !prev[list.id] }))}
                      aria-expanded={!!historyOpen[list.id]}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        border: 'none',
                        background: 'none',
                        padding: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#333',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <History size={15} aria-hidden="true" />
                      {t('packingLists.transitionHistory')}
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>
                        {historyOpen[list.id]
                          ? <ChevronUp size={16} aria-hidden="true" />
                          : <ChevronDown size={16} aria-hidden="true" />}
                      </span>
                    </button>
                    {historyOpen[list.id] && (
                      <div style={{ marginTop: 10 }}>
                    <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>{t('packingLists.listCreated')}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDateTime(d.createdAt)}</span>
                      <LocationIndicator location={d.creationLocation} eventLabel={t('packingLists.listCreated')} t={t} />
                    </div>
                    {d.workdayHistory?.length ? (
                      <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>{t('packingLists.workdayHistory')}</div>
                        {d.workdayHistory.map(event => (
                          <div key={event.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 12, color: '#555' }}>
                              {t('packingLists.workdayDay', { day: event.workdayIndex })}: {t(`packingLists.workdayEvent.${event.eventType}`)} · {fmtDateTime(event.confirmedAt || event.occurredAt)}
                              {event.actorName ? ` · ${event.actorName}` : ''}
                            </div>
                            <div style={{ marginTop: 4 }}>
                              <LocationIndicator
                                location={event.location}
                                eventLabel={`${t('packingLists.workdayDay', { day: event.workdayIndex })}: ${t(`packingLists.workdayEvent.${event.eventType}`)}`}
                                t={t}
                              />
                            </div>
                            {event.observations && (
                              <div style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
                                <strong>{t('packingLists.observations')}:</strong> {event.observations}
                              </div>
                            )}
                            {event.signatures && (
                              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>
                                    <Signature size={14} aria-hidden="true" />
                                    {t('packingLists.customerSignature')}
                                    {event.signatures.clientSignerName ? ` · ${event.signatures.clientSignerName}` : ''}
                                  </div>
                                  {event.signatures.clientSignatureUrl ? (
                                    <SignaturePreview
                                      src={event.signatures.clientSignatureUrl}
                                      alt={t('packingLists.customerSignature')}
                                      openLabel={t('packingLists.openSignature')}
                                      onOpen={setSelectedImage}
                                    />
                                  ) : (
                                    <div style={{ fontSize: 13, color: '#666' }}>{t('packingLists.signatureUnavailable')}</div>
                                  )}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>
                                    <Signature size={14} aria-hidden="true" />
                                    {t('packingLists.crewLeaderSignature')}
                                    {event.signatures.crewLeaderName ? ` · ${event.signatures.crewLeaderName}` : ''}
                                  </div>
                                  {event.signatures.crewLeaderSignatureUrl ? (
                                    <SignaturePreview
                                      src={event.signatures.crewLeaderSignatureUrl}
                                      alt={t('packingLists.crewLeaderSignature')}
                                      openLabel={t('packingLists.openSignature')}
                                      onOpen={setSelectedImage}
                                    />
                                  ) : (
                                    <div style={{ fontSize: 13, color: '#666' }}>{t('packingLists.signatureUnavailable')}</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {d.progressTransitions?.length ? d.progressTransitions.map(transition => {
                      const observations = transition.observations
                        || (transition.toStatus === 'COMPLETED' ? d.completionObservations : null)
                      return (
                      <div key={transition.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <ProgressBadge status={transition.toStatus} t={t} />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {t('packingLists.transitionMeta', {
                              actor: transition.actorName || '—',
                              date: fmtDateTime(transition.confirmedAt || transition.occurredAt),
                            })}
                          </span>
                          <LocationIndicator
                            location={transition.location}
                            eventLabel={packingProgressMeta(transition.toStatus, t).label}
                            t={t}
                          />
                        </div>
                        {observations && (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#555' }}>
                            <strong>
                              {t(transition.toStatus === 'WORKING'
                                ? 'packingLists.arrivalObservations'
                                : transition.toStatus === 'COMPLETED'
                                  ? 'packingLists.completionObservations'
                                  : 'packingLists.observations')}:
                            </strong>{' '}{observations}
                          </div>
                        )}
                        {transition.toStatus === 'WORKING' && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>
                              <Signature size={14} aria-hidden="true" />
                              {t('packingLists.arrivalAcknowledgement')}
                            </div>
                            {transition.signatureUrl ? (
                              <SignaturePreview
                                src={transition.signatureUrl}
                                alt={t('packingLists.arrivalAcknowledgement')}
                                openLabel={t('packingLists.openSignature')}
                                onOpen={setSelectedImage}
                              />
                            ) : (
                              <div style={{ fontSize: 13, color: '#666' }}>{t('packingLists.signatureUnavailable')}</div>
                            )}
                          </div>
                        )}
                      </div>
                      )
                    }) : (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('packingLists.noTransitions')}</div>
                    )}
                      </div>
                    )}
                  </div>
                )}
                {d?.ingressEgressOperations?.length > 0 && (
                  <div style={{ marginTop: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(prev => ({ ...prev, [`${list.id}-ingressEgress`]: !prev[`${list.id}-ingressEgress`] }))}
                      aria-expanded={!!historyOpen[`${list.id}-ingressEgress`]}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                        border: 'none', background: 'none', padding: 0, fontSize: 13, fontWeight: 700,
                        color: '#333', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <History size={15} aria-hidden="true" />
                      {t('packingLists.ingressEgressHistory')}
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>
                        {historyOpen[`${list.id}-ingressEgress`]
                          ? <ChevronUp size={16} aria-hidden="true" />
                          : <ChevronDown size={16} aria-hidden="true" />}
                      </span>
                    </button>
                    {historyOpen[`${list.id}-ingressEgress`] && (
                      <div style={{ marginTop: 10 }}>
                        {d.ingressEgressOperations.map(op => (
                      <div key={op.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>
                            {t(`packingLists.ingressEgressType.${op.type}`)}
                          </span>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                            background: op.status === 'COMPLETE' ? '#e6f4ea' : '#fff3cd',
                            color: op.status === 'COMPLETE' ? '#1e8e3e' : '#8a6d1f',
                          }}>
                            {t(`packingLists.ingressEgressStatus.${op.status}`)}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {fmtDateTime(op.completedAt || op.createdAt)}
                          </span>
                          <LocationIndicator location={op.location} eventLabel={t(`packingLists.ingressEgressType.${op.type}`)} t={t} />
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>
                          {t('packingLists.ingressEgressBoxes', { checked: op.boxes.filter(b => b.checked).length, total: op.boxes.length })}
                        </div>
                        {op.warehouseLocation && (
                          <div style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
                            <strong>{t('packingLists.warehouseLocation')}:</strong> {op.warehouseLocation}
                          </div>
                        )}
                        {op.observations && (
                          <div style={{ marginTop: 6, fontSize: 13, color: '#555' }}>
                            <strong>{t('packingLists.observations')}:</strong> {op.observations}
                          </div>
                        )}
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>
                              <Signature size={14} aria-hidden="true" />
                              {t('packingLists.crewLeaderSignature')}
                              {op.signatures.crewLeader?.name ? ` · ${op.signatures.crewLeader.name}` : ''}
                            </div>
                            {op.signatures.crewLeader?.signatureUrl ? (
                              <SignaturePreview
                                src={op.signatures.crewLeader.signatureUrl}
                                alt={t('packingLists.crewLeaderSignature')}
                                openLabel={t('packingLists.openSignature')}
                                onOpen={setSelectedImage}
                              />
                            ) : (
                              <div style={{ fontSize: 13, color: '#666' }}>{t('packingLists.signatureUnavailable')}</div>
                            )}
                          </div>
                          {(op.type === 'INGRESS_WAREHOUSE' || op.type === 'EGRESS_WAREHOUSE') && (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>
                                <Signature size={14} aria-hidden="true" />
                                {t('packingLists.warehouseManagerSignature')}
                                {op.signatures.warehouseManager?.name ? ` · ${op.signatures.warehouseManager.name}` : ''}
                              </div>
                              {op.signatures.warehouseManager?.signatureUrl ? (
                                <SignaturePreview
                                  src={op.signatures.warehouseManager.signatureUrl}
                                  alt={t('packingLists.warehouseManagerSignature')}
                                  openLabel={t('packingLists.openSignature')}
                                  onOpen={setSelectedImage}
                                />
                              ) : (
                                <div style={{ fontSize: 13, color: '#666' }}>{t('packingLists.signatureUnavailable')}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                      </div>
                    )}
                  </div>
                )}
                {d && (d.progressStatus === 'COMPLETED' || d.signatureUrl || d.signatureDeclined || d.satisfactionResponse) && (
                  <div style={{ marginTop: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 10 }}>
                      <Signature size={15} aria-hidden="true" />
                      {t('packingLists.completionSignOff')}
                    </div>
                    {(d.completionObservations || d.progressTransitions?.find(transition => transition.toStatus === 'COMPLETED')?.observations) && (
                      <div style={{ fontSize: 13, color: '#555', marginBottom: 10 }}>
                        <strong>{t('packingLists.completionObservations')}:</strong>{' '}
                        {d.completionObservations || d.progressTransitions.find(transition => transition.toStatus === 'COMPLETED').observations}
                      </div>
                    )}
                    {d.signatureDeclined && d.signatureDeclineNote && (
                      <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                        <strong>{t('packingLists.declineReason')}:</strong> {d.signatureDeclineNote}
                      </div>
                    )}
                    {(() => {
                      const finalEvent = d.workdayHistory?.find(event => event.eventType === 'FINAL_COMPLETE')
                      const crewSignatureUrl = finalEvent?.signatures?.crewLeaderSignatureUrl
                      const crewName = finalEvent?.signatures?.crewLeaderName
                      const clientName = finalEvent?.signatures?.clientSignerName
                      return (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>
                              <Signature size={14} aria-hidden="true" />
                              {t('packingLists.customerSignature')}
                              {clientName ? ` · ${clientName}` : ''}
                            </div>
                            {!d.signatureDeclined && d.signatureUrl ? (
                              <SignaturePreview
                                src={d.signatureUrl}
                                alt={t('packingLists.customerSignature')}
                                openLabel={t('packingLists.openSignature')}
                                onOpen={setSelectedImage}
                              />
                            ) : (
                              <div style={{ fontSize: 13, color: '#666' }}>
                                {d.signatureDeclined ? t('packingLists.declined') : t('packingLists.signatureUnavailable')}
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>
                              <Signature size={14} aria-hidden="true" />
                              {t('packingLists.crewLeaderSignature')}
                              {crewName ? ` · ${crewName}` : ''}
                            </div>
                            {crewSignatureUrl ? (
                              <SignaturePreview
                                src={crewSignatureUrl}
                                alt={t('packingLists.crewLeaderSignature')}
                                openLabel={t('packingLists.openSignature')}
                                onOpen={setSelectedImage}
                              />
                            ) : (
                              <div style={{ fontSize: 13, color: '#666' }}>{t('packingLists.signatureUnavailable')}</div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                    {d.satisfactionResponse && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13, color: '#555' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 6 }}>
                          <Star size={15} fill="currentColor" aria-hidden="true" />
                          {t('packingLists.satisfaction')}
                        </div>
                        <div>{t('packingLists.surveyVersion')}: {d.satisfactionResponse.surveyVersion}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                          <Star size={14} fill="currentColor" aria-hidden="true" />
                          {t('packingLists.overallRating')}: {t('packingLists.ratingValue', { rating: d.satisfactionResponse.answers?.overallRating ?? '-' })}
                        </div>
                      </div>
                    )}
                    {d.completionBlockedReason === 'MISSING_BOX_BARCODES' && (
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 12, color: '#b45309', fontWeight: 700 }}>
                        {t('packingLists.completionBlockedMissingBarcodes')}
                      </div>
                    )}
                  </div>
                )}
                {d && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                    <span>{t('packingLists.created')}: {fmtDateTime(d.createdAt)}</span>
                    <span>{t('packingLists.updated')}: {fmtDateTime(d.updatedAt)}</span>
                    {d.lockedByDeviceId && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <LockKeyhole size={13} aria-hidden="true" />
                        {t('packingLists.deviceLock')}: {d.lockedByDeviceId.slice(0, 8)}…
                      </span>
                    )}
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
              src={selectedImage.src}
              alt={selectedImage.alt || t('packingLists.enlargedImageAlt')}
              style={{ display: 'block', maxWidth: '90vw', maxHeight: '82vh', objectFit: 'contain', background: '#fff' }}
            />
            <div style={{ padding: 10, background: '#f7f8fa', textAlign: 'right', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: '#2563eb', color: '#fff', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                <X size={13} aria-hidden="true" />
                {t('packingLists.closeImage')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
