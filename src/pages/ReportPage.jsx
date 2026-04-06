import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import api from '../api/axios.js'
import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters.js'

// ── Local display helpers ───────────────────────────────────────────────────

// Alias for full currency used in tables
const usd = formatCurrency

// Compact Y-axis labels for charts
function usdShort(val) {
  if (val == null || isNaN(val)) return '$0'
  if (Math.abs(val) >= 1_000_000) return '$' + (val / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(val) >= 1_000) return '$' + (val / 1_000).toFixed(0) + 'K'
  return '$' + Math.round(val)
}

// Alias for percent
const pct = formatPercent

function num(val, decimals = 1) {
  if (val == null || isNaN(val)) return '0'
  return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ── Sub-components ─────────────────────────────────────────────────────────

function DiffCell({ value }) {
  if (value === 0) return <span className="text-green-600 font-medium">{usd(value)}</span>
  if (value > 0)   return <span className="text-red-600 font-medium">+{usd(value)}</span>
  return <span className="text-green-600 font-medium">{usd(value)}</span>
}

function ChartTooltipUSD({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {usd(p.value)}</p>
      ))}
    </div>
  )
}

function ChartTooltipHours({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {num(p.value)} hrs</p>
      ))}
    </div>
  )
}

// Show every Nth x-axis tick to avoid crowding
function sparseTickFormatter(weeklyData, n = 4) {
  return (value, index) => (index % n === 0 ? value : '')
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ReportPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [weeklyOpen, setWeeklyOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Guard — redirect if no state
  if (!state?.result || !state?.formData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <p className="text-gray-500 mb-4">No report data found. Please run the calculator first.</p>
        <button
          onClick={() => navigate('/')}
          className="bg-[#1e3a5f] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#163152] transition-colors"
        >
          Back to Calculator
        </button>
      </div>
    )
  }

  const { result, formData } = state
  const { summary, weeklyData, projectInfo } = result
  const { phases } = projectInfo

  // Build recharts-ready tick formatter using actual data length
  const xTickFormatter = sparseTickFormatter(weeklyData, 4)

  // ── PDF Export ───────────────────────────────────────────────────────────
  async function handleExportPdf() {
    setExporting(true)
    try {
      const response = await api.post(
        '/api/export-pdf',
        { result, formData },
        { responseType: 'arraybuffer' }
      )
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `escalation-report-${formData.projectInfo.estimateNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-28">

      {/* ── Header Bar ──────────────────────────────────────────────────── */}
      <div className="bg-[#1e3a5f] rounded-2xl overflow-hidden mb-6 shadow-md">
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Escalation Report</h1>
            <p className="text-blue-200 text-sm mt-0.5">
              {formData.schedule.startDate} — {formData.schedule.endDate}
            </p>
          </div>
          <div className="text-right text-sm text-blue-100 space-y-0.5">
            <p><span className="text-blue-300">Estimate #</span> {formData.projectInfo.estimateNumber}</p>
            <p><span className="text-blue-300">BidTracer #</span> {formData.projectInfo.bidTracerNumber}</p>
            <p><span className="text-blue-300">Date</span> {formData.projectInfo.date}</p>
            <p><span className="text-blue-300">Bid Date</span> {formData.projectInfo.bidDate}</p>
          </div>
        </div>

        {/* Phase tags */}
        {phases?.length > 0 && (
          <div className="px-6 pb-4 flex flex-wrap gap-2">
            {phases.map((p, i) => (
              <span
                key={i}
                className="text-xs bg-white/10 text-blue-100 border border-white/20 rounded-full px-3 py-1"
              >
                {p.name} · {p.startDate} – {p.endDate}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Summary Table ────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Cost Summary</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3 font-medium">Category</th>
                <th className="text-right px-4 py-3 font-medium">Original Budget</th>
                <th className="text-right px-4 py-3 font-medium">Escalated Total</th>
                <th className="text-right px-4 py-3 font-medium">$ Difference</th>
                <th className="text-right px-6 py-3 font-medium">% Escalation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-6 py-3 font-medium text-gray-800">Materials</td>
                <td className="px-4 py-3 text-right text-gray-700">{usd(summary.budgetedMaterial)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{usd(summary.escalatedMaterial)}</td>
                <td className="px-4 py-3 text-right"><DiffCell value={summary.materialDifference} /></td>
                <td className="px-6 py-3 text-right text-gray-700">{pct(summary.materialEscPercent)}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 font-medium text-gray-800">Labor</td>
                <td className="px-4 py-3 text-right text-gray-700">{usd(summary.budgetedLabor)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{usd(summary.escalatedLabor)}</td>
                <td className="px-4 py-3 text-right"><DiffCell value={summary.laborDifference} /></td>
                <td className="px-6 py-3 text-right text-gray-700">{pct(summary.laborEscPercent)}</td>
              </tr>
              <tr className="bg-[#1e3a5f]/5 font-bold">
                <td className="px-6 py-3 text-[#1e3a5f]">TOTAL</td>
                <td className="px-4 py-3 text-right text-[#1e3a5f]">{usd(summary.totalBudget)}</td>
                <td className="px-4 py-3 text-right text-[#1e3a5f]">{usd(summary.totalEscalated)}</td>
                <td className="px-4 py-3 text-right"><DiffCell value={summary.totalDifference} /></td>
                <td className="px-6 py-3 text-right text-[#1e3a5f]">{pct(summary.totalEscPercent)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Chart 1: Cumulative Material Cost ───────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5">
          Cumulative Material Cost
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={weeklyData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={xTickFormatter}
              interval={0}
            />
            <YAxis
              tickFormatter={usdShort}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              width={64}
            />
            <Tooltip content={<ChartTooltipUSD />} />
            <ReferenceLine
              y={summary.budgetedMaterial}
              stroke="#f97316"
              strokeDasharray="4 3"
              label={{ value: 'Original Budget', position: 'insideTopRight', fontSize: 10, fill: '#f97316' }}
            />
            <Line
              type="monotone"
              dataKey="cumulativeMaterial"
              name="Cum. Material"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* ── Chart 2: Cumulative Labor Cost ──────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5">
          Cumulative Labor Cost
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={weeklyData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={xTickFormatter}
              interval={0}
            />
            <YAxis
              tickFormatter={usdShort}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              width={64}
            />
            <Tooltip content={<ChartTooltipUSD />} />
            <ReferenceLine
              y={summary.budgetedLabor}
              stroke="#f97316"
              strokeDasharray="4 3"
              label={{ value: 'Original Budget', position: 'insideTopRight', fontSize: 10, fill: '#f97316' }}
            />
            <Line
              type="monotone"
              dataKey="cumulativeLabor"
              name="Cum. Labor"
              stroke="#16a34a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* ── Chart 3: Worker Hours per Week ──────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-5">
          Worker Hours per Week
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={weeklyData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickFormatter={xTickFormatter}
              interval={0}
            />
            <YAxis
              tickFormatter={(v) => num(v, 0)}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              width={48}
            />
            <Tooltip content={<ChartTooltipHours />} />
            <Bar dataKey="hours" name="Hours" fill="#9333ea" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ── Weekly Data Table (collapsible) ─────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <button
          onClick={() => setWeeklyOpen(o => !o)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="uppercase tracking-wide">Weekly Detail</span>
          <span className="flex items-center gap-2 text-xs font-normal text-gray-400">
            {weeklyOpen ? 'Hide' : `View ${weeklyData.length} weeks`}
            <svg
              className={`w-4 h-4 transition-transform ${weeklyOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </button>

        {weeklyOpen && (
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                  <th className="text-center px-3 py-2 font-medium">Wk</th>
                  <th className="text-left px-3 py-2 font-medium">Week Of</th>
                  <th className="text-right px-3 py-2 font-medium">Mat. Cost</th>
                  <th className="text-right px-3 py-2 font-medium">Labor Cost</th>
                  <th className="text-right px-3 py-2 font-medium">Hours</th>
                  <th className="text-right px-3 py-2 font-medium">Cum. Material</th>
                  <th className="text-right px-3 py-2 font-medium">Cum. Labor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {weeklyData.map((row) => (
                  <tr key={row.week} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-3 py-1.5 text-center text-gray-500">{row.week}</td>
                    <td className="px-3 py-1.5 text-gray-700 font-medium whitespace-nowrap">{row.weekLabel}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{usd(row.materialCost)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{usd(row.laborCost)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{num(row.hours, 1)}</td>
                    <td className="px-3 py-1.5 text-right text-blue-700 font-medium">{usd(row.cumulativeMaterial)}</td>
                    <td className="px-3 py-1.5 text-right text-green-700 font-medium">{usd(row.cumulativeLabor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Sticky Bottom Bar ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={() => navigate('/', { state: { formData } })}
            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-gray-300 text-gray-700
                       px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Calculator
          </button>

          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1e3a5f] text-white
                       px-8 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#163152] transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed min-w-[160px]"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Exporting…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  )
}
