import { useEffect, useRef, useState } from 'react'
import SignaturePad from 'signature_pad'
import { api } from '../../api'
import { useLanguage } from '../../i18n'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024

export default function MyProfilePage() {
  const { t } = useLanguage()
  const [staff, setStaff]                     = useState(null)
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [emailSignature, setEmailSignature]   = useState('')
  const [saved, setSaved]                     = useState(false)
  const [error, setError]                     = useState(null)
  const [signatureImageUrl, setSignatureImageUrl] = useState(null)
  const [imageUploading, setImageUploading]   = useState(false)
  const [imageError, setImageError]           = useState(null)
  const [sigTab, setSigTab]                   = useState('upload')
  const savedTimer = useRef(null)
  const fileInputRef = useRef(null)
  const canvasRef   = useRef(null)
  const sigPadRef   = useRef(null)

  useEffect(() => {
    api.get('/staff/me')
      .then(member => {
        setStaff(member)
        setEmailSignature(member?.emailSignature || '')
        setSignatureImageUrl(member?.signatureImageUrl || null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Initialise SignaturePad when the draw tab becomes active
  useEffect(() => {
    if (sigTab !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    if (sigPadRef.current) { sigPadRef.current.off(); sigPadRef.current = null }
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width  = canvas.offsetWidth  * ratio
    canvas.height = canvas.offsetHeight * ratio
    canvas.getContext('2d').scale(ratio, ratio)
    sigPadRef.current = new SignaturePad(canvas, { backgroundColor: 'rgb(255,255,255)' })
  }, [sigTab])

  const handleDrawClear = () => sigPadRef.current?.clear()

  const handleDrawSave = async () => {
    const pad = sigPadRef.current
    if (!pad || pad.isEmpty()) { setImageError(t('profile.signatureDrawEmpty')); return }
    setImageError(null)
    setImageUploading(true)
    try {
      const dataUrl = pad.toDataURL('image/png')
      const blob = await (await fetch(dataUrl)).blob()
      const formData = new FormData()
      formData.append('file', blob, 'signature.png')
      const result = await api.upload('/staff/me/signature-image', formData)
      setSignatureImageUrl(result.signatureImageUrl)
      setSigTab('upload')
    } catch (err) {
      setImageError(err.message)
    } finally {
      setImageUploading(false)
    }
  }

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await api.put('/staff/me/profile', { emailSignature })
      setSaved(true)
      clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError(null)
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image must be under 2 MB.')
      e.target.value = ''
      return
    }
    setImageUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await api.upload('/staff/me/signature-image', formData)
      setSignatureImageUrl(result.signatureImageUrl)
    } catch (err) {
      setImageError(err.message)
    } finally {
      setImageUploading(false)
      e.target.value = ''
    }
  }

  const handleImageDelete = async () => {
    if (!window.confirm(t('profile.signatureImageDeleteConfirm'))) return
    setImageError(null)
    setImageUploading(true)
    try {
      await api.delete('/staff/me/signature-image')
      setSignatureImageUrl(null)
    } catch (err) {
      setImageError(err.message)
    } finally {
      setImageUploading(false)
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{t('profile.title')}</div>
          <div className="page-subtitle">{staff ? staff.name : ''}</div>
        </div>
      </div>

      {!staff ? (
        <div className="alert alert-error">{t('profile.noStaffRecord')}</div>
      ) : (
        <form onSubmit={handleSave}>
          {/* Read-only info */}
          <div className="card card-body" style={{ marginBottom: 16 }}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">{t('staff.name')}</label>
                <input className="form-control" value={staff.name} readOnly style={{ background: 'var(--bg)', color: 'var(--text-muted)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('staff.email')}</label>
                <input className="form-control" value={staff.email} readOnly style={{ background: 'var(--bg)', color: 'var(--text-muted)' }} />
              </div>
            </div>
          </div>

          {/* Signature section */}
          <div className="card card-body" style={{ marginBottom: 16 }}>
            <div className="section-label">{t('profile.signatureSection')}</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 16px' }}>{t('profile.signatureHint')}</p>

            {/* Text */}
            <div className="form-group">
              <label className="form-label">{t('profile.signatureTextLabel')}</label>
              <textarea
                className="form-control"
                rows={5}
                value={emailSignature}
                onChange={e => setEmailSignature(e.target.value)}
                placeholder={t('staff.emailSignaturePlaceholder')}
                style={{ fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            {/* Image / Draw */}
            <div className="form-group" style={{ marginTop: 8 }}>
              <label className="form-label">{t('profile.signatureImageLabel')}</label>

              {/* Tab switcher */}
              <div style={{ display: 'flex', marginBottom: 12, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
                {['upload', 'draw'].map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setImageError(null); setSigTab(tab) }}
                    style={{
                      padding: '6px 18px', border: 'none', cursor: 'pointer', fontSize: 13,
                      background: sigTab === tab ? 'var(--primary)' : 'transparent',
                      color: sigTab === tab ? '#fff' : 'var(--text)',
                    }}
                  >
                    {tab === 'upload' ? t('profile.signatureTabUpload') : t('profile.signatureTabDraw')}
                  </button>
                ))}
              </div>

              {sigTab === 'upload' && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>{t('profile.signatureImageHint')}</p>
                  {signatureImageUrl && (
                    <div style={{ marginBottom: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 6, display: 'inline-block', background: '#fff' }}>
                      <img src={signatureImageUrl} alt="Signature" style={{ display: 'block', height: 80, maxWidth: 320, objectFit: 'contain' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={handleImageChange} />
                    <button type="button" className="btn btn-secondary btn-sm" disabled={imageUploading} onClick={() => fileInputRef.current?.click()}>
                      {imageUploading ? t('common.saving') : t('profile.signatureImageUpload')}
                    </button>
                    {signatureImageUrl && (
                      <button type="button" className="btn btn-danger btn-sm" disabled={imageUploading} onClick={handleImageDelete}>
                        {t('profile.signatureImageDelete')}
                      </button>
                    )}
                  </div>
                </>
              )}

              {sigTab === 'draw' && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>{t('profile.signatureDrawHint')}</p>
                  <canvas
                    ref={canvasRef}
                    style={{
                      display: 'block', width: '100%', maxWidth: 480, height: 160,
                      border: '1px solid var(--border)', borderRadius: 6,
                      background: '#fff', cursor: 'crosshair', touchAction: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleDrawClear}>
                      {t('profile.signatureDrawClear')}
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" disabled={imageUploading} onClick={handleDrawSave}>
                      {imageUploading ? t('common.saving') : t('profile.signatureDrawSave')}
                    </button>
                  </div>
                </>
              )}

              {imageError && <div className="alert alert-error" style={{ marginTop: 8 }}>{imageError}</div>}
            </div>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
            {saved && <span style={{ fontSize: 13, color: '#16a34a', alignSelf: 'center' }}>✓ {t('profile.saved')}</span>}
          </div>
        </form>
      )}
    </>
  )
}
