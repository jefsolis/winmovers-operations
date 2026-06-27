import { useState, useEffect } from 'react'
import { api } from '../../api'
import { useLanguage, tEn } from '../../i18n'

export default function FidiReport() {
  const { t } = useLanguage()
  const [availableYears, setAvailableYears] = useState([])
  const [selectedYears, setSelectedYears] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [yearsLoading, setYearsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/reports/fidi/years')
      .then(data => {
        const years = Array.isArray(data?.years) ? data.years : []
        setAvailableYears(years)
        setSelectedYears(years)
      })
      .catch(() => {})
      .finally(() => setYearsLoading(false))
  }, [])

  const toggleYear = (year) => {
    setSelectedYears(prev =>
      prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year].sort((a, b) => a - b)
    )
  }

  const handleGenerate = async () => {
    if (selectedYears.length === 0) return
    setLoading(true)
    setError(null)
    setReport(null)
    try {
      const data = await api.get(`/reports/fidi?years=${selectedYears.join(',')}`)
      setReport(data)
    } catch (e) {
      setError(e.message || 'Error loading report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200 }}>
      <h1 style={{ marginBottom: 4 }}>{t('fidi.title')}</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>{t('fidi.subtitle')}</p>

      {/* Year selector */}
      <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>{t('fidi.selectYears')}</div>
        {yearsLoading ? (
          <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>{t('common.loading')}</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {availableYears.map(year => {
              const active = selectedYears.includes(year)
              return (
                <button
                  key={year}
                  onClick={() => toggleYear(year)}
                  className={`btn ${active ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ minWidth: 72 }}
                >
                  {year}
                </button>
              )
            })}
          </div>
        )}
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={loading || selectedYears.length === 0}
          style={{ minWidth: 160 }}
        >
          {loading ? t('fidi.generating') : t('fidi.generate')}
        </button>
        {selectedYears.length === 0 && (
          <span style={{ marginLeft: 12, color: '#e53e3e', fontSize: 13 }}>{t('fidi.noYears')}</span>
        )}
      </div>

      {error && <div style={{ color: '#e53e3e', marginBottom: 16 }}>{error}</div>}

      {report && (
        <>
          {/* Data quality warning */}
          {report.unclassified?.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 8, padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
                  {report.unclassified.length} {report.unclassified.length === 1 ? t('fidi.warnFileSingular') : t('fidi.warnFilePlural')}
                </div>
                <div style={{ fontSize: 13, color: '#78350f' }}>
                  {t('fidi.warnDetail')}
                </div>
                <div style={{ fontSize: 12, color: '#92400e', marginTop: 6, fontFamily: 'monospace', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {report.unclassified.map(fn => (
                    <span key={fn} style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 4, padding: '1px 6px' }}>{fn}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Summary tables */}
          <h2 style={{ marginBottom: 16 }}>{tEn('fidi.summaryTitle')}</h2>

          {/* Counts table */}
          <CopyableTable
            label={tEn('fidi.countsTableTitle')}
            headers={['', ...report.summaries.map(s => String(s.year))]}
            rows={[
              [tEn('fidi.colBooker'), ...report.summaries.map(s => s.counts.booker)],
              [tEn('fidi.colOA'),     ...report.summaries.map(s => s.counts.oa)],
              [tEn('fidi.colDA'),     ...report.summaries.map(s => s.counts.da)],
            ]}
            t={t}
          >
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th></Th>
                  {report.summaries.map(s => <Th key={s.year}>{s.year}</Th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>{tEn('fidi.colBooker')}</Td>
                  {report.summaries.map(s => <Td key={s.year}>{s.counts.booker}</Td>)}
                </tr>
                <tr>
                  <Td>{tEn('fidi.colOA')}</Td>
                  {report.summaries.map(s => <Td key={s.year}>{s.counts.oa}</Td>)}
                </tr>
                <tr>
                  <Td>{tEn('fidi.colDA')}</Td>
                  {report.summaries.map(s => <Td key={s.year}>{s.counts.da}</Td>)}
                </tr>
              </tbody>
            </table>
          </CopyableTable>

          {/* Percentages table */}
          <CopyableTable
            label={tEn('fidi.pctTableTitle')}
            headers={['', tEn('fidi.colPctTotalHeader')]}
            rows={[
              [tEn('fidi.colPctBooker'),       `${report.totals?.percentages?.booker ?? '0.00'}%`],
              [tEn('fidi.colPctOA'),           `${report.totals?.percentages?.oa ?? '0.00'}%`],
              [tEn('fidi.colPctDA'),           `${report.totals?.percentages?.da ?? '0.00'}%`],
              [tEn('fidi.colPctThirdCountry'), '0.00%'],
              [tEn('fidi.colPctTotal'),        '100.00%'],
            ]}
            t={t}
          >
            <table style={tableStyle}>
              <thead>
                <tr>
                  <Th></Th>
                  <Th>{tEn('fidi.colPctTotalHeader')}</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>{tEn('fidi.colPctBooker')}</Td>
                  <Td>{report.totals?.percentages?.booker ?? '0.00'}%</Td>
                </tr>
                <tr>
                  <Td>{tEn('fidi.colPctOA')}</Td>
                  <Td>{report.totals?.percentages?.oa ?? '0.00'}%</Td>
                </tr>
                <tr>
                  <Td>{tEn('fidi.colPctDA')}</Td>
                  <Td>{report.totals?.percentages?.da ?? '0.00'}%</Td>
                </tr>
                <tr>
                  <Td>{tEn('fidi.colPctThirdCountry')}</Td>
                  <Td>0.00%</Td>
                </tr>
                <tr style={{ background: '#f0f0f0' }}>
                  <Td bold>{tEn('fidi.colPctTotal')}</Td>
                  <Td bold>100.00%</Td>
                </tr>
              </tbody>
            </table>
          </CopyableTable>

          {/* Export list */}
          <JobList
            title={tEn('fidi.exportListTitle')}
            rows={report.exportList}
            t={t}
          />

          {/* Import list */}
          <JobList
            title={tEn('fidi.importListTitle')}
            rows={report.importList}
            t={t}
          />
        </>
      )}
    </div>
  )
}

function JobList({ title, rows, t }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const headers = [
      tEn('fidi.colYear'), tEn('fidi.colFileNumber'), tEn('fidi.colImportExport'),
      tEn('fidi.colBookerRole'), tEn('fidi.colOriginAgent'), tEn('fidi.colDestAgent'),
      tEn('fidi.colOriginCountry'), tEn('fidi.colDestCountry'), tEn('fidi.colServiceType'),
      tEn('fidi.colTransport'), tEn('fidi.colVolume'), tEn('fidi.colCustoms'),
    ]
    const dataRows = rows.map(row =>
      row.cancelled
        ? [row.year, row.fileNumber, tEn('fidi.cancelled'), '', '', '', '', '', '', '', '', '']
        : [
            row.year, row.fileNumber, row.importOrExport, row.bookerRole,
            row.originAgent, row.destAgent, row.originCountry, row.destCountry,
            row.serviceType, row.transportMethod, row.volumeCbm, row.customsClearance,
          ]
    )
    const tsv = [headers, ...dataRows].map(r => r.join('\t')).join('\n')
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!rows || rows.length === 0) return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ marginBottom: 8 }}>{title}</h2>
      <p style={{ color: '#888' }}>{t('fidi.noData')}</p>
    </div>
  )

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
          {copied ? t('fidi.copied') : t('fidi.copyToClipboard')}
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>{tEn('fidi.colYear')}</Th>
              <Th>{tEn('fidi.colFileNumber')}</Th>
              <Th>{tEn('fidi.colImportExport')}</Th>
              <Th>{tEn('fidi.colBookerRole')}</Th>
              <Th>{tEn('fidi.colOriginAgent')}</Th>
              <Th>{tEn('fidi.colDestAgent')}</Th>
              <Th>{tEn('fidi.colOriginCountry')}</Th>
              <Th>{tEn('fidi.colDestCountry')}</Th>
              <Th>{tEn('fidi.colServiceType')}</Th>
              <Th>{tEn('fidi.colTransport')}</Th>
              <Th>{tEn('fidi.colVolume')}</Th>
              <Th>{tEn('fidi.colCustoms')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              row.cancelled ? (
                <tr key={i} style={{ background: '#fff5f5' }}>
                  <Td>{row.year}</Td>
                  <Td>{row.fileNumber}</Td>
                  <Td colSpan={10} style={{ color: '#e53e3e', fontWeight: 600, fontStyle: 'italic' }}>
                    {tEn('fidi.cancelled')}
                  </Td>
                </tr>
              ) : (
                <tr key={i}>
                  <Td>{row.year}</Td>
                  <Td>{row.fileNumber}</Td>
                  <Td>{row.importOrExport}</Td>
                  <Td>{row.bookerRole}</Td>
                  <Td>{row.originAgent}</Td>
                  <Td>{row.destAgent}</Td>
                  <Td>{row.originCountry}</Td>
                  <Td>{row.destCountry}</Td>
                  <Td>{row.serviceType}</Td>
                  <Td>{row.transportMethod}</Td>
                  <Td>{row.volumeCbm}</Td>
                  <Td>{row.customsClearance}</Td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
}

function CopyableTable({ label, headers, rows, children, t }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const tsv = [headers, ...rows].map(r => r.join('\t')).join('\n')
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
          {copied ? t('fidi.copied') : t('fidi.copyToClipboard')}
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

function Th({ children }) {
  return (
    <th style={{ background: '#f0f0f0', border: '1px solid #d0d0d0', padding: '8px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {children}
    </th>
  )
}

function Td({ children, bold, colSpan, style }) {
  return (
    <td colSpan={colSpan} style={{ border: '1px solid #e0e0e0', padding: '7px 12px', fontWeight: bold ? 600 : 400, ...style }}>
      {children}
    </td>
  )
}
