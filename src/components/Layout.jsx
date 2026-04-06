import { Outlet, useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'

export default function Layout() {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(!!localStorage.getItem('adminToken'))

  // Sync isAdmin if token changes in another tab
  useEffect(() => {
    const syncAuth = () => setIsAdmin(!!localStorage.getItem('adminToken'))
    window.addEventListener('storage', syncAuth)
    return () => window.removeEventListener('storage', syncAuth)
  }, [])

  function handleLogout() {
    localStorage.clear()
    setIsAdmin(false)
    navigate('/')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-[#1e3a5f] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left — brand */}
            <Link
              to="/"
              className="text-white text-lg font-semibold tracking-wide hover:text-blue-200 transition-colors"
            >
              Escalation Calculator
            </Link>

            {/* Right — nav links */}
            <div className="flex items-center gap-6">
              {isAdmin ? (
                <>
                  <Link
                    to="/admin/dashboard"
                    className="text-blue-200 hover:text-white text-sm font-medium transition-colors"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium text-blue-200 hover:text-white transition-colors cursor-pointer"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/admin/login"
                  className="text-blue-200 hover:text-white text-sm font-medium transition-colors"
                >
                  Admin Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
