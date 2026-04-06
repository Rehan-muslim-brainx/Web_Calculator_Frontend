import { useEffect, useState, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FileText, Calendar, Layers, Package, Users } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { toPng } from 'html-to-image'
import api from '../api/axios.js'
import { formatCurrency, formatPercent } from '../utils/formatters.js'

// ── Unchanged form helpers ─────────────────────────────────────────────────

function fmt(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return '$0'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function FieldError({ error }) {
  if (!error) return null
  return <p className="text-red-400 text-xs mt-1">{error.message}</p>
}

function Label({ children, required }) {
  return (
    <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

const inputCls =
  'w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white ' +
  'focus:outline-none focus:border-blue-400 focus:bg-white/15 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)] ' +
  'placeholder-white/30 transition-all duration-150 disabled:opacity-50'

const errorInputCls =
  'w-full bg-white/10 border border-red-400 rounded-lg px-3 py-2 text-sm text-white ' +
  'focus:outline-none focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(248,113,113,0.2)] ' +
  'placeholder-white/30 transition-all duration-150'

const selectCls =
  'w-full bg-[#1e3a5f] border border-white/20 rounded-lg px-3 py-2 text-sm text-white ' +
  'focus:outline-none focus:border-blue-400 focus:shadow-[0_0_0_3px_rgba(96,165,250,0.15)] ' +
  'transition-all duration-150 disabled:opacity-50'

const selectErrorCls =
  'w-full bg-[#1e3a5f] border border-red-400 rounded-lg px-3 py-2 text-sm text-white ' +
  'focus:outline-none focus:border-red-400 transition-all duration-150'

function Input({ registration, error, ...props }) {
  return <input className={error ? errorInputCls : inputCls} {...registration} {...props} />
}

// ── Sidebar section card ───────────────────────────────────────────────────

function SidebarSection({ title, icon: Icon, accent, delay = 0, children }) {
  return (
    <div
      className="rounded-xl border-l-4 bg-white/5 p-5 animate-slide-in"
      style={{ borderLeftColor: accent, animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg" style={{ backgroundColor: accent + '22' }}>
          <Icon size={14} style={{ color: accent }} />
        </div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-white/70">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Results panel helpers ──────────────────────────────────────────────────

const usd = formatCurrency
const pct = formatPercent

function usdShort(val) {
  if (val == null || isNaN(val)) return '$0'
  if (Math.abs(val) >= 1_000_000) return '$' + (val / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(val) >= 1_000) return '$' + (val / 1_000).toFixed(0) + 'K'
  return '$' + Math.round(val)
}

function numFmt(val, decimals = 1) {
  if (val == null || isNaN(val)) return '0'
  return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function DiffCell({ value }) {
  if (value === 0) return <span className="text-green-600 font-semibold">{usd(value)}</span>
  if (value > 0)   return <span className="text-red-600 font-semibold">+{usd(value)}</span>
  return <span className="text-green-600 font-semibold">{usd(value)}</span>
}

function ChartTooltipUSD({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {usd(p.value)}</p>)}
    </div>
  )
}

function ChartTooltipHours({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {numFmt(p.value)} hrs</p>)}
    </div>
  )
}

function xFmt(value, index) { return index % 4 === 0 ? value : '' }

// ── Right panel — placeholder cards ───────────────────────────────────────

const cardCls = 'bg-white rounded-2xl border border-[#e8edf2] p-5 animate-fade-in'
const cardShadow = { boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }

function ShimmerBox({ label }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl p-4 border border-[#e2e8f0]" style={{ backgroundColor: '#f0f4f8' }}>
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
      <span className="text-2xl font-bold text-gray-300" style={{ animation: 'shimmerPulse 1.5s ease-in-out infinite' }}>—</span>
    </div>
  )
}

function PlaceholderChart({ title, type = 'line' }) {
  return (
    <div className={cardCls} style={cardShadow}>
      <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">{title}</h3>
      <div className="relative h-[200px] bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((y, i) => (
            <line key={i} x1="0" y1={`${y * 100}%`} x2="100%" y2={`${y * 100}%`} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
          ))}
          {[0.2, 0.4, 0.6, 0.8].map((x, i) => (
            <line key={i} x1={`${x * 100}%`} y1="0" x2={`${x * 100}%`} y2="100%" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
          ))}
          {type === 'line' && (
            <path d="M 20,160 C 80,140 120,80 180,60 S 280,40 340,30 S 440,25 500,20"
              fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />
          )}
          {type === 'line2' && (
            <path d="M 20,155 C 60,150 100,130 160,100 S 260,60 320,45 S 420,30 500,22"
              fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 4" strokeLinecap="round" />
          )}
          {type === 'bar' && (
            <>
              {[{x:40,h:60},{x:110,h:100},{x:180,h:75},{x:250,h:130},{x:320,h:90},{x:390,h:50}].map((bar, i) => (
                <rect key={i} x={bar.x} y={200 - bar.h} width="50" height={bar.h} fill="#e2e8f0" rx="4" />
              ))}
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-gray-300 font-medium tracking-wide select-none">Chart will appear here</span>
        </div>
      </div>
    </div>
  )
}

function RightPanelPlaceholder() {
  return (
    <div className="space-y-5">
      <div className={cardCls} style={cardShadow}>
        <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Cost Summary</h3>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
          <ShimmerBox label="Original Budget" />
          <ShimmerBox label="Escalated Total" />
          <ShimmerBox label="$ Difference" />
          <ShimmerBox label="% Escalation" />
        </div>
        <p className="text-xs text-gray-400 text-center pt-3 border-t border-gray-100">
          Fill in project details and click <span className="font-semibold text-[#3b82f6]">Calculate</span> to see results
        </p>
      </div>
      <PlaceholderChart title="Cumulative Material Cost" type="line" />
      <PlaceholderChart title="Cumulative Labor Cost" type="line2" />
      <PlaceholderChart title="Worker Hours per Week" type="bar" />
    </div>
  )
}

// ── Right panel — real results ─────────────────────────────────────────────

function ResultsPanel({ results, formData, onClear }) {
  const { summary, weeklyData } = results
  const [exporting, setExporting] = useState(false)
  const [weeklyOpen, setWeeklyOpen] = useState(false)

  const materialChartRef = useRef(null)
  const laborChartRef = useRef(null)
  const hoursChartRef = useRef(null)

  async function handleExportPdf() {
    setExporting(true)
    try {
      // Capture each chart as a base64 PNG before sending to backend
      const captureOpts = { backgroundColor: '#ffffff', pixelRatio: 2, quality: 1.0 }
      let materialChartImg, laborChartImg, hoursChartImg
      try {
        ;[materialChartImg, laborChartImg, hoursChartImg] = await Promise.all([
          toPng(materialChartRef.current, captureOpts),
          toPng(laborChartRef.current, captureOpts),
          toPng(hoursChartRef.current, captureOpts),
        ])
      } catch (captureErr) {
        console.warn('Chart capture failed, exporting without charts:', captureErr)
      }

      const response = await api.post(
        '/api/export-pdf',
        {
          result: results,
          formData,
          chartImages: { materialChart: materialChartImg, laborChart: laborChartImg, hoursChart: hoursChartImg },
        },
        { responseType: 'arraybuffer' }
      )
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `escalation-report-${formData.projectInfo.estimateNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.error('PDF export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5" style={{ animation: 'resultsIn 0.4s ease-out both' }}>

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 transition-colors bg-white"
          style={cardShadow}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Recalculate
        </button>
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1e3a5f] hover:bg-[#163152] rounded-lg px-4 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={cardShadow}
        >
          {exporting ? (
            <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Exporting…</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>Export PDF</>
          )}
        </button>
      </div>

      {/* Cost Summary */}
      <div className={cardCls} style={cardShadow}>
        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Cost Summary</h3>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Original Budget', value: usd(summary.totalBudget) },
            { label: 'Escalated Total', value: usd(summary.totalEscalated) },
            { label: '$ Difference', value: null, diff: summary.totalDifference },
            { label: '% Escalation', value: pct(summary.totalEscPercent) },
          ].map(({ label, value, diff }) => (
            <div key={label} className="flex flex-col gap-1.5 rounded-xl p-3 border border-[#e2e8f0]" style={{ backgroundColor: '#f0f4f8' }}>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
              <span className="text-lg font-bold text-gray-800">
                {diff !== undefined ? <DiffCell value={diff} /> : value}
              </span>
            </div>
          ))}
        </div>

        {/* Summary table */}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Category</th>
                <th className="text-right px-3 py-2.5 font-medium">Original</th>
                <th className="text-right px-3 py-2.5 font-medium">Escalated</th>
                <th className="text-right px-3 py-2.5 font-medium">Diff</th>
                <th className="text-right px-4 py-2.5 font-medium">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-4 py-2.5 font-medium text-gray-700">Materials</td>
                <td className="px-3 py-2.5 text-right text-gray-600 text-xs">{usd(summary.budgetedMaterial)}</td>
                <td className="px-3 py-2.5 text-right text-gray-600 text-xs">{usd(summary.escalatedMaterial)}</td>
                <td className="px-3 py-2.5 text-right text-xs"><DiffCell value={summary.materialDifference} /></td>
                <td className="px-4 py-2.5 text-right text-gray-600 text-xs">{pct(summary.materialEscPercent)}</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-gray-700">Labor</td>
                <td className="px-3 py-2.5 text-right text-gray-600 text-xs">{usd(summary.budgetedLabor)}</td>
                <td className="px-3 py-2.5 text-right text-gray-600 text-xs">{usd(summary.escalatedLabor)}</td>
                <td className="px-3 py-2.5 text-right text-xs"><DiffCell value={summary.laborDifference} /></td>
                <td className="px-4 py-2.5 text-right text-gray-600 text-xs">{pct(summary.laborEscPercent)}</td>
              </tr>
              <tr className="bg-[#1e3a5f]/5 font-bold">
                <td className="px-4 py-2.5 text-[#1e3a5f] text-sm">TOTAL</td>
                <td className="px-3 py-2.5 text-right text-[#1e3a5f] text-xs">{usd(summary.totalBudget)}</td>
                <td className="px-3 py-2.5 text-right text-[#1e3a5f] text-xs">{usd(summary.totalEscalated)}</td>
                <td className="px-3 py-2.5 text-right text-xs"><DiffCell value={summary.totalDifference} /></td>
                <td className="px-4 py-2.5 text-right text-[#1e3a5f] text-xs">{pct(summary.totalEscPercent)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart 1 — Cumulative Material */}
      <div className={cardCls} style={cardShadow}>
        <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Cumulative Material Cost</h3>
        <div ref={materialChartRef} style={{ width: '100%', height: '280px', backgroundColor: '#ffffff' }}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={weeklyData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={xFmt} interval={0} />
              <YAxis tickFormatter={usdShort} tick={{ fontSize: 11, fill: '#9ca3af' }} width={60} />
              <Tooltip content={<ChartTooltipUSD />} />
              <ReferenceLine y={summary.budgetedMaterial} stroke="#f97316" strokeDasharray="4 3"
                label={{ value: 'Budget', position: 'insideTopRight', fontSize: 10, fill: '#f97316' }} />
              <Line type="monotone" dataKey="cumulativeMaterial" name="Cum. Material"
                stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2 — Cumulative Labor */}
      <div className={cardCls} style={cardShadow}>
        <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Cumulative Labor Cost</h3>
        <div ref={laborChartRef} style={{ width: '100%', height: '280px', backgroundColor: '#ffffff' }}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={weeklyData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={xFmt} interval={0} />
              <YAxis tickFormatter={usdShort} tick={{ fontSize: 11, fill: '#9ca3af' }} width={60} />
              <Tooltip content={<ChartTooltipUSD />} />
              <ReferenceLine y={summary.budgetedLabor} stroke="#f97316" strokeDasharray="4 3"
                label={{ value: 'Budget', position: 'insideTopRight', fontSize: 10, fill: '#f97316' }} />
              <Line type="monotone" dataKey="cumulativeLabor" name="Cum. Labor"
                stroke="#16a34a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3 — Hours */}
      <div className={cardCls} style={cardShadow}>
        <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase tracking-wide">Worker Hours per Week</h3>
        <div ref={hoursChartRef} style={{ width: '100%', height: '280px', backgroundColor: '#ffffff' }}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={xFmt} interval={0} />
              <YAxis tickFormatter={v => numFmt(v, 0)} tick={{ fontSize: 11, fill: '#9ca3af' }} width={44} />
              <Tooltip content={<ChartTooltipHours />} />
              <Bar dataKey="hours" name="Hours" fill="#9333ea" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly detail table (collapsible) */}
      <div className="bg-white rounded-2xl border border-[#e8edf2] overflow-hidden" style={cardShadow}>
        <button
          onClick={() => setWeeklyOpen(o => !o)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="uppercase tracking-wide text-xs">Weekly Detail</span>
          <span className="flex items-center gap-2 text-xs font-normal text-gray-400">
            {weeklyOpen ? 'Hide' : `View ${weeklyData.length} weeks`}
            <svg className={`w-4 h-4 transition-transform ${weeklyOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
                {weeklyData.map(row => (
                  <tr key={row.week} className="hover:bg-gray-50/60">
                    <td className="px-3 py-1.5 text-center text-gray-500">{row.week}</td>
                    <td className="px-3 py-1.5 font-medium text-gray-700 whitespace-nowrap">{row.weekLabel}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{usd(row.materialCost)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{usd(row.laborCost)}</td>
                    <td className="px-3 py-1.5 text-right text-gray-600">{numFmt(row.hours, 1)}</td>
                    <td className="px-3 py-1.5 text-right text-blue-700 font-medium">{usd(row.cumulativeMaterial)}</td>
                    <td className="px-3 py-1.5 text-right text-green-700 font-medium">{usd(row.cumulativeLabor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}

// ── Constants ──────────────────────────────────────────────────────────────

const EMPTY_DEFAULTS = {
  projectInfo: { estimateNumber: '', bidTracerNumber: '', date: '', bidDate: '' },
  schedule: { startDate: '', endDate: '' },
  phases: [{ name: '', startDate: '', endDate: '', estimatedHours: '', curveId: '' }],
  materials: { budget: '', escalationPercent: '', anniversaryDate: '' },
  labor: { budget: '', escalationPercent: '', anniversaryDate: '' },
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function UserCalculator() {
  const navigate = useNavigate()
  const location = useLocation()
  const [curveOptions, setCurveOptions] = useState([])
  const [loadingCurves, setLoadingCurves] = useState(true)
  const [results, setResults] = useState(null)
  const [savedFormData, setSavedFormData] = useState(null)

  // ── Unchanged form logic ─────────────────────────────────────────────────
  const {
    register, control, handleSubmit, watch, setError, reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: EMPTY_DEFAULTS })

  const { fields, append, remove } = useFieldArray({ control, name: 'phases' })

  const matBudget = watch('materials.budget')
  const labBudget = watch('labor.budget')
  const totalBudget = (parseFloat(matBudget) || 0) + (parseFloat(labBudget) || 0)

  useEffect(() => {
    if (location.state?.formData) reset(location.state.formData)
  }, [location.state, reset])

  useEffect(() => {
    api.get('/api/curves?public=true')
      .then(({ data }) => setCurveOptions(data.map(c => ({ id: c.id, name: c.name }))))
      .catch(() => toast.error('Failed to load curve options'))
      .finally(() => setLoadingCurves(false))
  }, [])

  function checkPhaseOverlaps(phases) {
    for (let i = 0; i < phases.length; i++) {
      for (let j = i + 1; j < phases.length; j++) {
        const a = phases[i], b = phases[j]
        if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) continue
        const overlap = new Date(a.startDate) < new Date(b.endDate) &&
                        new Date(b.startDate) < new Date(a.endDate)
        if (overlap) return { i, j }
      }
    }
    return null
  }

  async function onSubmit(data) {
    const overlap = checkPhaseOverlaps(data.phases)
    if (overlap) {
      const { i, j } = overlap
      setError(`phases.${i}.startDate`, { type: 'manual', message: `This phase overlaps with Phase ${j + 1}` })
      setError(`phases.${j}.startDate`, { type: 'manual', message: `This phase overlaps with Phase ${i + 1}` })
      return
    }
    const payload = {
      projectInfo: data.projectInfo,
      schedule: data.schedule,
      phases: data.phases.map(p => ({ ...p, estimatedHours: parseFloat(p.estimatedHours) })),
      materials: {
        budget: parseFloat(data.materials.budget),
        escalationPercent: parseFloat(data.materials.escalationPercent),
        anniversaryDate: data.materials.anniversaryDate,
      },
      labor: {
        budget: parseFloat(data.labor.budget),
        escalationPercent: parseFloat(data.labor.escalationPercent),
        anniversaryDate: data.labor.anniversaryDate,
      },
    }
    try {
      const { data: result } = await api.post('/api/calculate', payload)
      setResults(result)
      setSavedFormData(data)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Calculation failed. Please try again.')
    }
  }
  // ── End unchanged logic ───────────────────────────────────────────────────

  if (loadingCurves) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-[#1e3a5f]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm text-gray-400">Loading curves…</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmerPulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
        @keyframes resultsIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in { animation: slideIn 0.4s ease both; }
        .animate-fade-in  { animation: fadeIn  0.5s ease both; }
        .sidebar-form option { background: #1e3a5f; color: white; }
        .calc-btn:hover:not(:disabled) {
          box-shadow: 0 0 0 4px rgba(59,130,246,0.25), 0 4px 16px rgba(59,130,246,0.35);
          transform: scale(1.02);
        }
        .calc-btn { transition: all 0.2s ease; }
      `}</style>

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">

        {/* ══ LEFT PANEL — Sidebar ════════════════════════════════════════ */}
        <div className="lg:w-[420px] lg:min-w-[420px] lg:max-w-[420px] bg-[#1e3a5f] flex flex-col lg:h-[calc(100vh-4rem)] lg:sticky lg:top-16 lg:overflow-y-auto">

          <div className="px-6 pt-7 pb-4 flex-shrink-0">
            <h1 className="text-xl font-bold text-white">Escalation Calculator</h1>
            <p className="text-blue-200/70 text-xs mt-1">Fill in project details to calculate cost escalation.</p>
          </div>

          <form id="calc-form" onSubmit={handleSubmit(onSubmit)} noValidate
            className="sidebar-form flex-1 px-5 pb-4 space-y-4 overflow-y-auto">

            {/* SECTION 1 — Project Info */}
            <SidebarSection title="Project Info" icon={FileText} accent="#60a5fa" delay={0}>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label required>Estimate #</Label>
                  <Input registration={register('projectInfo.estimateNumber', { required: 'Required' })}
                    error={errors.projectInfo?.estimateNumber} placeholder="EST-2024-001" />
                  <FieldError error={errors.projectInfo?.estimateNumber} />
                </div>
                <div className="col-span-2">
                  <Label required>BidTracer #</Label>
                  <Input registration={register('projectInfo.bidTracerNumber', { required: 'Required' })}
                    error={errors.projectInfo?.bidTracerNumber} placeholder="BT-10042" />
                  <FieldError error={errors.projectInfo?.bidTracerNumber} />
                </div>
                <div>
                  <Label required>Date</Label>
                  <Input type="date" registration={register('projectInfo.date', { required: 'Required' })}
                    error={errors.projectInfo?.date} />
                  <FieldError error={errors.projectInfo?.date} />
                </div>
                <div>
                  <Label required>Bid Date</Label>
                  <Input type="date" registration={register('projectInfo.bidDate', { required: 'Required' })}
                    error={errors.projectInfo?.bidDate} />
                  <FieldError error={errors.projectInfo?.bidDate} />
                </div>
              </div>
            </SidebarSection>

            {/* SECTION 2 — Overall Schedule */}
            <SidebarSection title="Overall Schedule" icon={Calendar} accent="#34d399" delay={100}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label required>Start Date</Label>
                  <Input type="date" registration={register('schedule.startDate', { required: 'Required' })}
                    error={errors.schedule?.startDate} />
                  <FieldError error={errors.schedule?.startDate} />
                </div>
                <div>
                  <Label required>End Date</Label>
                  <Input type="date" registration={register('schedule.endDate', {
                    required: 'Required',
                    validate: val => {
                      const start = watch('schedule.startDate')
                      if (start && val && new Date(val) <= new Date(start)) return 'Must be after start date'
                      return true
                    },
                  })} error={errors.schedule?.endDate} />
                  <FieldError error={errors.schedule?.endDate} />
                </div>
              </div>
            </SidebarSection>

            {/* SECTION 3 — Phases */}
            <SidebarSection title="Phases" icon={Layers} accent="#fb923c" delay={200}>
              <div className="space-y-5">
                {fields.map((field, index) => (
                  <div key={field.id}>
                    {index > 0 && <div className="border-t border-white/10 mb-4" />}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-orange-300 uppercase tracking-wider">Phase {index + 1}</span>
                      {index > 0 && (
                        <button type="button" onClick={() => remove(index)}
                          className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors">
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label required>Phase Name</Label>
                        <Input registration={register(`phases.${index}.name`, { required: 'Required' })}
                          error={errors.phases?.[index]?.name} placeholder="e.g. Civil Works" />
                        <FieldError error={errors.phases?.[index]?.name} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label required>Start Date</Label>
                          <Input type="date" registration={register(`phases.${index}.startDate`, { required: 'Required' })}
                            error={errors.phases?.[index]?.startDate} />
                          <FieldError error={errors.phases?.[index]?.startDate} />
                        </div>
                        <div>
                          <Label required>End Date</Label>
                          <Input type="date" registration={register(`phases.${index}.endDate`, {
                            required: 'Required',
                            validate: val => {
                              const start = watch(`phases.${index}.startDate`)
                              if (start && val && new Date(val) <= new Date(start)) return 'Must be after start date'
                              return true
                            },
                          })} error={errors.phases?.[index]?.endDate} />
                          <FieldError error={errors.phases?.[index]?.endDate} />
                        </div>
                        <div>
                          <Label required>Est. Hours</Label>
                          <Input type="number" min="0" step="0.01"
                            registration={register(`phases.${index}.estimatedHours`, {
                              required: 'Required',
                              min: { value: 0.01, message: 'Must be > 0' },
                              valueAsNumber: false,
                            })} error={errors.phases?.[index]?.estimatedHours} placeholder="0.00" />
                          <FieldError error={errors.phases?.[index]?.estimatedHours} />
                        </div>
                        <div>
                          <Label required>Curve Type</Label>
                          <select className={errors.phases?.[index]?.curveId ? selectErrorCls : selectCls}
                            {...register(`phases.${index}.curveId`, { required: 'Required' })}>
                            <option value="">Select…</option>
                            {curveOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <FieldError error={errors.phases?.[index]?.curveId} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {fields.length < 3 && (
                  <button type="button"
                    onClick={() => append({ name: '', startDate: '', endDate: '', estimatedHours: '', curveId: '' })}
                    className="flex items-center gap-1.5 text-xs font-semibold text-orange-300 hover:text-orange-200 transition-colors mt-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Phase
                  </button>
                )}
              </div>
            </SidebarSection>

            {/* SECTION 4 — Materials */}
            <SidebarSection title="Materials" icon={Package} accent="#a78bfa" delay={300}>
              <div className="space-y-3">
                <div>
                  <Label required>Material Budget ($)</Label>
                  <Input type="number" min="0" step="0.01"
                    registration={register('materials.budget', { required: 'Required', min: { value: 0.01, message: 'Must be greater than 0' } })}
                    error={errors.materials?.budget} placeholder="$0.00" />
                  <FieldError error={errors.materials?.budget} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label required>Escalation % / Year</Label>
                    <Input type="number" min="0" step="0.01"
                      registration={register('materials.escalationPercent', { required: 'Required', min: { value: 0, message: 'Cannot be negative' } })}
                      error={errors.materials?.escalationPercent} placeholder="0.00" />
                    <FieldError error={errors.materials?.escalationPercent} />
                  </div>
                  <div>
                    <Label required>Anniversary Date</Label>
                    <Input type="date" registration={register('materials.anniversaryDate', { required: 'Required' })}
                      error={errors.materials?.anniversaryDate} />
                    <FieldError error={errors.materials?.anniversaryDate} />
                  </div>
                </div>
              </div>
            </SidebarSection>

            {/* SECTION 5 — Labor */}
            <SidebarSection title="Labor" icon={Users} accent="#f87171" delay={400}>
              <div className="space-y-3">
                <div>
                  <Label required>Labor Budget ($)</Label>
                  <Input type="number" min="0" step="0.01"
                    registration={register('labor.budget', { required: 'Required', min: { value: 0.01, message: 'Must be greater than 0' } })}
                    error={errors.labor?.budget} placeholder="$0.00" />
                  <FieldError error={errors.labor?.budget} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label required>Escalation % / Year</Label>
                    <Input type="number" min="0" step="0.01"
                      registration={register('labor.escalationPercent', { required: 'Required', min: { value: 0, message: 'Cannot be negative' } })}
                      error={errors.labor?.escalationPercent} placeholder="0.00" />
                    <FieldError error={errors.labor?.escalationPercent} />
                  </div>
                  <div>
                    <Label required>Anniversary Date</Label>
                    <Input type="date" registration={register('labor.anniversaryDate', { required: 'Required' })}
                      error={errors.labor?.anniversaryDate} />
                    <FieldError error={errors.labor?.anniversaryDate} />
                  </div>
                </div>
              </div>
            </SidebarSection>

            <div className="h-28" />
          </form>

          {/* Sticky bottom bar */}
          <div className="flex-shrink-0 border-t border-white/10 bg-[#163152] px-5 py-4">
            <div className="text-xs text-blue-200/70 mb-3 flex flex-wrap gap-x-2 gap-y-1">
              <span><span className="text-white/60">Material:</span> <span className="text-white font-semibold">{fmt(matBudget)}</span></span>
              <span className="text-white/30">+</span>
              <span><span className="text-white/60">Labor:</span> <span className="text-white font-semibold">{fmt(labBudget)}</span></span>
              <span className="text-white/30">=</span>
              <span className="text-blue-300 font-bold">Total: {fmt(totalBudget === 0 ? '' : totalBudget)}</span>
            </div>
            <button type="submit" form="calc-form" disabled={isSubmitting}
              className="calc-btn w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white py-2.5 rounded-xl
                         text-sm font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2">
              {isSubmitting ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>Calculating…</>
              ) : 'Calculate Escalation →'}
            </button>
          </div>
        </div>

        {/* ══ RIGHT PANEL ═════════════════════════════════════════════════ */}
        <div className="flex-1 bg-[#f8fafc] lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-8">
            <div className="mb-6 animate-fade-in">
              <h2 className="text-lg font-bold text-[#1e3a5f]">
                {results ? 'Escalation Results' : 'Results Preview'}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {results
                  ? 'Your cost escalation report is ready.'
                  : 'Complete the form and calculate to see your escalation report.'}
              </p>
            </div>

            {results
              ? <ResultsPanel results={results} formData={savedFormData} onClear={() => setResults(null)} />
              : <RightPanelPlaceholder />
            }
          </div>
        </div>

      </div>
    </>
  )
}
