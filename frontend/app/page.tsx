import Link from "next/link";

/**
 * Landing page — shown only to unauthenticated users.
 * Middleware redirects authenticated users straight to their dashboard.
 */
export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-lg w-full text-center space-y-6">
        <h1 className="text-4xl font-bold text-gray-900">
          Grievance Portal
        </h1>
        <p className="text-lg text-gray-600">
          A transparent, blockchain-backed grievance redressal system
          for your institute. Every action is recorded on-chain — immutable
          and tamper-proof.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-6 py-3 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            Register
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-10 text-sm text-gray-500">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <p className="font-semibold text-gray-700">Immutable</p>
            <p>Every action recorded on-chain</p>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <p className="font-semibold text-gray-700">Transparent</p>
            <p>Track your grievance in real time</p>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <p className="font-semibold text-gray-700">Accountable</p>
            <p>Auto-escalates if ignored</p>
          </div>
        </div>
      </div>
    </main>
  );
}
