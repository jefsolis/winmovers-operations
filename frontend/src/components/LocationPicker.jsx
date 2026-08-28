import { useState } from 'react'
import { MapPin, MapPinOff, X } from 'lucide-react'
import { googleMapsUrl, isValidCoordinatePair, parseCoordinateInput } from '../constants'
import { useLanguage } from '../i18n'

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export default function LocationPicker({ latitude, longitude, onChange }) {
  const { t } = useLanguage()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)

  const hasCoordinates = isValidCoordinatePair(Number(latitude), Number(longitude))

  const apply = () => {
    const parsed = parseCoordinateInput(draft)
    if (!parsed) {
      setError(t('jobs.coordinateErrors.UNPARSEABLE'))
      return
    }
    if (parsed.error) {
      setError(t(`jobs.coordinateErrors.${parsed.error}`))
      return
    }
    setError(null)
    setDraft('')
    onChange(parsed.latitude, parsed.longitude)
  }

  const clear = () => {
    setError(null)
    setDraft('')
    onChange(null, null)
  }

  const embedSrc = hasCoordinates && MAPS_API_KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${MAPS_API_KEY}&q=${latitude},${longitude}&zoom=17`
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#333' }}>
        {hasCoordinates
          ? <MapPin size={14} aria-hidden="true" />
          : <MapPinOff size={14} aria-hidden="true" />}
        {t('jobs.serviceCoordinates')}
        <span style={{
          marginLeft: 6,
          fontSize: 11,
          fontWeight: 700,
          borderRadius: 6,
          padding: '2px 6px',
          background: hasCoordinates ? '#e6f4ea' : '#f1f3f4',
          color: hasCoordinates ? '#1e8e3e' : '#5f6368',
        }}>
          {hasCoordinates ? t('jobs.hasExactCoordinates') : t('jobs.addressOnly')}
        </span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('jobs.serviceCoordinatesHint')}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={t('jobs.serviceCoordinatesPlaceholder')}
          aria-label={t('jobs.serviceCoordinates')}
          style={{ flex: '1 1 260px', minWidth: 200, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
        />
        <button
          type="button"
          onClick={apply}
          style={{ border: 'none', background: '#1a73e8', color: '#fff', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {t('jobs.serviceCoordinatesApply')}
        </button>
        {hasCoordinates && (
          <button
            type="button"
            onClick={clear}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', background: '#fff', color: '#c5221f', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <X size={13} aria-hidden="true" />
            {t('jobs.serviceCoordinatesClear')}
          </button>
        )}
      </div>

      {error && <div style={{ fontSize: 12, color: '#c5221f', fontWeight: 700 }}>{error}</div>}

      {hasCoordinates && (
        <div style={{ fontSize: 12, color: '#555' }}>
          {latitude}, {longitude} ·{' '}
          <a href={googleMapsUrl(latitude, longitude)} target="_blank" rel="noopener noreferrer" style={{ color: '#1a73e8', fontWeight: 700 }}>
            {t('packingLists.openLocation')}
          </a>
        </div>
      )}

      {embedSrc ? (
        <iframe
          title={t('jobs.serviceCoordinates')}
          src={embedSrc}
          style={{ width: '100%', height: 220, border: '1px solid var(--border)', borderRadius: 8 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {MAPS_API_KEY ? t('jobs.serviceCoordinatesSelectOnMap') : t('jobs.serviceCoordinatesMapUnavailable')}
        </div>
      )}
    </div>
  )
}
