import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-center px-4">
      <p className="text-8xl font-extrabold text-[#1e3a5f] mb-4">404</p>
      <h1 className="text-2xl font-semibold text-gray-700 mb-2">Page not found</h1>
      <p className="text-gray-500 mb-8">The page you're looking for doesn't exist.</p>
      <Link
        to="/"
        className="bg-[#1e3a5f] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#163152] transition-colors"
      >
        Back to Calculator
      </Link>
    </div>
  )
}
