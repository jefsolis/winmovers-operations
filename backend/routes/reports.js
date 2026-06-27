const router = require('express').Router()
const { getPrisma } = require('../db')

// Normalize shipment mode to FIDI standard values
function normalizeShipmentMode(mode) {
  if (!mode) return ''
  const m = mode.toUpperCase()
  if (m === 'AIR' || m === 'AEREO' || m === 'AÉREO') return 'Air'
  if (m === 'SEA' || m === 'MARITIMO' || m === 'MARÍTIMO') return 'Sea'
  if (m === 'ROAD' || m === 'TERRESTRE') return 'Land'
  return mode
}

function pct(n, total) {
  if (total === 0) return '0.00'
  return (n / total * 100).toFixed(2)
}

// GET /api/reports/fidi/years — returns years that have EXPORT/IMPORT file data
router.get('/fidi/years', async (req, res, next) => {
  try {
    const files = await getPrisma().movingFile.findMany({
      where: { category: { in: ['EXPORT', 'IMPORT'] } },
      select: { createdAt: true },
    })
    const yearSet = new Set(files.map(f => new Date(f.createdAt).getFullYear()))
    const years = [...yearSet].sort((a, b) => a - b)
    res.json({ years })
  } catch (err) {
    next(err)
  }
})

// GET /api/reports/fidi?years=2024,2025
router.get('/fidi', async (req, res, next) => {
  try {
    const rawYears = (req.query.years || '')
      .split(',')
      .map(y => parseInt(y.trim(), 10))
      .filter(y => !isNaN(y) && y > 1990 && y < 2100)

    if (rawYears.length === 0) {
      return res.status(400).json({ error: 'At least one valid year is required (e.g. ?years=2025)' })
    }

    const years = [...new Set(rawYears)].sort()
    const minYear = years[0]
    const maxYear = years[years.length - 1]
    const from = new Date(minYear, 0, 1, 0, 0, 0, 0)
    const to   = new Date(maxYear, 11, 31, 23, 59, 59, 999)

    // Fetch all EXPORT/IMPORT files for the date range (including soft-deleted for completeness)
    const files = await getPrisma().movingFile.findMany({
      where: {
        category: { in: ['EXPORT', 'IMPORT'] },
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        fileNumber: true,
        category: true,
        bookerRole: true,
        serviceType: true,
        shipmentMode: true,
        volumeCbm: true,
        createdAt: true,
        deletedAt: true,
        originAgent: { select: { name: true } },
        destAgent:   { select: { name: true } },
        job: {
          select: {
            originCountry: true,
            destCountry: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'asc' },
        { fileNumber: 'asc' },
      ],
    })

    // Build per-year summaries (active files only for counts)
    const yearStats = {}
    for (const year of years) {
      yearStats[year] = { booker: 0, oa: 0, da: 0 }
    }

    for (const f of files) {
      if (f.deletedAt) continue
      const y = new Date(f.createdAt).getFullYear()
      if (!yearStats[y]) continue
      const role = (f.bookerRole || '').toUpperCase()
      if (role === 'BOOKER')     yearStats[y].booker++
      else if (role === 'OA')    yearStats[y].oa++
      else if (role === 'DA')    yearStats[y].da++
      // files with no bookerRole are excluded from counts and percentages
    }

    // Collect files missing bookerRole for data quality warning
    const unclassified = files
      .filter(f => !f.deletedAt && !f.bookerRole)
      .map(f => f.fileNumber)

    const summaries = years.map(year => {
      const s = yearStats[year]
      const total = s.booker + s.oa + s.da
      return {
        year,
        counts: {
          booker: s.booker,
          oa:     s.oa,
          da:     s.da,
          total,
        },
      }
    })

    // Aggregate totals across all selected years (for the percentages table)
    const agg = { booker: 0, oa: 0, da: 0 }
    for (const year of years) {
      agg.booker += yearStats[year].booker
      agg.oa     += yearStats[year].oa
      agg.da     += yearStats[year].da
    }
    const aggTotal = agg.booker + agg.oa + agg.da
    const totals = {
      booker: agg.booker,
      oa:     agg.oa,
      da:     agg.da,
      total:  aggTotal,
      percentages: {
        booker:       pct(agg.booker, aggTotal),
        oa:           pct(agg.oa, aggTotal),
        da:           pct(agg.da, aggTotal),
        thirdCountry: '0.00',
      },
    }

    // Build detail rows (export and import separately, all files including deleted)
    function buildRow(f) {
      const year = new Date(f.createdAt).getFullYear()
      if (f.deletedAt) {
        return {
          year,
          fileNumber: f.fileNumber,
          cancelled: true,
        }
      }
      return {
        year,
        fileNumber:       f.fileNumber,
        cancelled:        false,
        importOrExport:   f.category === 'EXPORT' ? 'Export' : 'Import',
        bookerRole:       f.bookerRole || '',
        originAgent:      f.originAgent?.name || '',
        destAgent:        f.destAgent?.name   || '',
        originCountry:    f.job?.originCountry || '',
        destCountry:      f.job?.destCountry   || '',
        serviceType:      f.serviceType        || '',
        transportMethod:  normalizeShipmentMode(f.shipmentMode),
        volumeCbm:        f.volumeCbm != null ? f.volumeCbm : '',
        customsClearance: 'YES',
      }
    }

    const exportList = files
      .filter(f => f.category === 'EXPORT' && years.includes(new Date(f.createdAt).getFullYear()))
      .map(buildRow)

    const importList = files
      .filter(f => f.category === 'IMPORT' && years.includes(new Date(f.createdAt).getFullYear()))
      .map(buildRow)

    res.json({ years, summaries, totals, unclassified, exportList, importList })
  } catch (err) {
    next(err)
  }
})

module.exports = router
