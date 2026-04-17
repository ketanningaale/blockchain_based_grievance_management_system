import Link from "next/link";

/**
 * Landing page — shown only to unauthenticated users.
 * Middleware redirects authenticated users straight to their dashboard.
 */
export default function LandingPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4 py-16"
      style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #e8eeff 30%, #f5f0ff 60%, #fef0ff 100%)" }}
    >
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-blue-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-indigo-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-purple-200/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl w-full text-center space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-blue-500/30 animate-float">
            <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
            Blockchain-Secured Platform
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold">
            <span className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent">
              Grievance Portal
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-xl mx-auto leading-relaxed">
            A transparent, blockchain-backed grievance redressal system for your institute.
            Every action is recorded on-chain — immutable and tamper-proof.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login"
            className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm
                       hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl
                       hover:shadow-blue-500/30 active:scale-[0.98]"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-8 py-3.5 bg-white/80 backdrop-blur-sm border border-blue-200 text-blue-700 rounded-xl font-semibold text-sm
                       hover:bg-white hover:border-blue-300 hover:shadow-md transition-all"
          >
            Create Account
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          {[
            {
              icon: "🔗",
              title: "Immutable",
              desc: "Every action permanently recorded on-chain with cryptographic proof",
            },
            {
              icon: "👁️",
              title: "Transparent",
              desc: "Track your grievance through every stage in real time",
            },
            {
              icon: "⚡",
              title: "Accountable",
              desc: "Auto-escalates to higher authorities if deadlines are missed",
            },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 p-5 shadow-sm
                         hover:shadow-md hover:bg-white/90 transition-all duration-200 text-left"
            >
              <div className="text-2xl mb-2">{icon}</div>
              <p className="font-bold text-gray-900 text-sm">{title}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          Secured by blockchain · IPFS-stored content · Immutable audit trail
        </p>
      </div>
    </main>
  );
}
