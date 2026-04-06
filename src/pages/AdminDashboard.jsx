import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/axios.js'

// ── Helpers ────────────────────────────────────────────────────────────────

function sumWeeks(weeks) {
  if (!Array.isArray(weeks)) return 0
  return weeks.reduce((a, b) => a + (parseFloat(b) || 0), 0)
}

function isValidSum(s) {
  return s >= 0.99 && s <= 1.01
}

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function emptyWeeks() {
  return Array(52).fill('')
}

// ── Small reusable pieces ──────────────────────────────────────────────────

function Badge({ active }) {
  return active
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Inactive</span>
}

function SumCheck({ weeks }) {
  const s = sumWeeks(weeks)
  const ok = isValidSum(s)
  return ok
    ? <span className="text-green-600 font-medium text-xs">✓ {s.toFixed(4)}</span>
    : <span className="text-red-500 font-medium text-xs">✗ {s.toFixed(4)}</span>
}

function IconBtn({ onClick, title, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-colors ${className}`}
    >
      {children}
    </button>
  )
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5].map(i => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ── Curve Modal ────────────────────────────────────────────────────────────

function CurveModal({ curve, onClose, onSaved }) {
  const isEdit = !!curve
  const [name, setName] = useState(isEdit ? curve.name : '')
  const [weeks, setWeeks] = useState(isEdit ? curve.weeks.map(String) : emptyWeeks())
  const [saving, setSaving] = useState(false)

  const liveSum = sumWeeks(weeks)
  const sumValid = isValidSum(liveSum)
  const canSave = name.trim().length > 0 && sumValid && !saving

  function handleWeekChange(i, val) {
    setWeeks(prev => { const next = [...prev]; next[i] = val; return next })
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      name: name.trim(),
      weeks: weeks.map(v => parseFloat(v) || 0),
    }
    try {
      if (isEdit) {
        await api.put(`/api/curves/${curve.id}`, payload)
        toast.success(`"${payload.name}" updated`)
      } else {
        await api.post('/api/curves', payload)
        toast.success(`"${payload.name}" created`)
      }
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#1e3a5f]">
            {isEdit ? `Edit Curve — ${curve.name}` : 'Add New Curve'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">

          {/* Name */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-600 mb-1">Curve Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Bell, Frontloaded…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
            />
          </div>

          {/* 52 week inputs */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-600 mb-3">Weekly Values (52 weeks)</label>
            <div className="grid grid-cols-4 gap-2">
              {weeks.map((val, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 w-8 flex-shrink-0 text-right">Wk {i + 1}</span>
                  <input
                    type="number"
                    step="0.000001"
                    min="0"
                    value={val}
                    onChange={e => handleWeekChange(i, e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1e3a5f] focus:border-transparent text-right"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Live sum indicator */}
          <div className={`flex items-center gap-2 text-sm font-medium mt-3 px-3 py-2 rounded-lg ${sumValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            <span>{sumValid ? '✓ Valid' : '✗ Must sum to 1.0 (±0.01)'}</span>
            <span className="ml-auto font-mono text-xs">Sum: {liveSum.toFixed(6)}</span>
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-5 py-2 text-sm font-semibold text-white bg-[#1e3a5f] rounded-lg
                       hover:bg-[#163152] transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center gap-2"
          >
            {saving && (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {saving ? 'Saving…' : 'Save Curve'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm Dialog ──────────────────────────────────────────────────

function ConfirmDialog({ curveName, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Delete Curve</h3>
            <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Are you sure you want to delete <span className="font-semibold text-gray-800">"{curveName}"</span>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting && (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CSV Upload Panel ───────────────────────────────────────────────────────

function CsvUploadPanel({ onUploaded }) {
  const [csvName, setCsvName] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  function downloadSampleCSV() {
    const rows = ['week_index,percent']
    for (let i = 1; i <= 52; i++) {
      rows.push(`${i},${(1 / 52).toFixed(8)}`)
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample_curve.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleUpload() {
    if (!csvName.trim() || !file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('name', csvName.trim())
    formData.append('file', file)
    try {
      await api.post('/api/curves/upload-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success(`"${csvName.trim()}" imported from CSV`)
      setCsvName('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      onUploaded()
    } catch (err) {
      toast.error(err.response?.data?.error || 'CSV upload failed')
    } finally {
      setUploading(false)
    }
  }

  const canUpload = csvName.trim().length > 0 && !!file && !uploading

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Import Curve from CSV</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            CSV must have two columns: <code className="bg-gray-100 px-1 rounded">week_index</code> (1–52)
            and <code className="bg-gray-100 px-1 rounded">percent</code> (decimal e.g. 0.05 or percentage e.g. 5.0).
            File must have exactly 52 rows.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Curve Name</label>
          <input
            type="text"
            value={csvName}
            onChange={e => setCsvName(e.target.value)}
            placeholder="e.g. Custom_Q3"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">CSV File</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={e => setFile(e.target.files[0] || null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
                       file:text-xs file:font-medium file:bg-[#1e3a5f] file:text-white hover:file:bg-[#163152]
                       file:cursor-pointer cursor-pointer border border-gray-300 rounded-lg px-2 py-1.5"
          />
        </div>
        <button
          onClick={downloadSampleCSV}
          type="button"
          title="Download a sample CSV showing the correct format"
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg
                     hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
          Sample CSV
        </button>
        <button
          onClick={handleUpload}
          disabled={!canUpload}
          className="px-5 py-2 text-sm font-semibold text-white bg-[#1e3a5f] rounded-lg
                     hover:bg-[#163152] transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center gap-2 whitespace-nowrap"
        >
          {uploading && (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [curves, setCurves] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalCurve, setModalCurve] = useState(null)   // null = closed, false = new, obj = edit
  const [deleteTarget, setDeleteTarget] = useState(null) // curve to delete
  const [deleting, setDeleting] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      navigate('/admin/login', { replace: true })
    }
  }, [navigate])

  const fetchCurves = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/curves')
      setCurves(data)
    } catch {
      toast.error('Failed to load curves')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCurves() }, [fetchCurves])

  function handleLogout() {
    localStorage.clear()
    navigate('/')
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/api/curves/${deleteTarget.id}`)
      toast.success(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      fetchCurves()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  async function handleToggle(curve) {
    setTogglingId(curve.id)
    try {
      await api.patch(`/api/curves/${curve.id}/toggle`)
      setCurves(prev =>
        prev.map(c => c.id === curve.id ? { ...c, is_active: !c.is_active } : c)
      )
    } catch (err) {
      toast.error(err.response?.data?.error || 'Toggle failed')
    } finally {
      setTogglingId(null)
    }
  }

  function handleModalSaved() {
    setModalCurve(null)
    fetchCurves()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">Curve Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage production curves used in escalation calculations.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalCurve(false)}
              className="flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#163152] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add New Curve
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* ── Curves Table ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Production Curves</h2>
            <span className="text-xs text-gray-400">{curves.length} curve{curves.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-6 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Sum Check</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                  <th className="text-right px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                ) : curves.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No curves found. Add one to get started.
                    </td>
                  </tr>
                ) : (
                  curves.map(curve => (
                    <tr key={curve.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-3 font-semibold text-gray-800">{curve.name}</td>
                      <td className="px-4 py-3"><SumCheck weeks={curve.weeks} /></td>
                      <td className="px-4 py-3"><Badge active={curve.is_active} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(curve.created_at)}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit */}
                          <IconBtn
                            onClick={() => setModalCurve(curve)}
                            title="Edit curve"
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </IconBtn>

                          {/* Toggle active */}
                          <IconBtn
                            onClick={() => handleToggle(curve)}
                            title={curve.is_active ? 'Deactivate' : 'Activate'}
                            className={curve.is_active
                              ? 'text-green-600 hover:text-green-800 hover:bg-green-50'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}
                          >
                            {togglingId === curve.id ? (
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </IconBtn>

                          {/* Delete */}
                          <IconBtn
                            onClick={() => setDeleteTarget(curve)}
                            title="Delete curve"
                            className="text-red-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── CSV Upload Panel ──────────────────────────────────────────── */}
        <CsvUploadPanel onUploaded={fetchCurves} />

      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {modalCurve !== null && (
        <CurveModal
          curve={modalCurve || null}
          onClose={() => setModalCurve(null)}
          onSaved={handleModalSaved}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          curveName={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  )
}
