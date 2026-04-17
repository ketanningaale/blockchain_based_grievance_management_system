import Link from "next/link";
import { Shield, ArrowRight, CheckCircle2, Link2, Eye, Zap, FileText, Bell, TrendingUp } from "lucide-react";

const FEATURES = [
  {
    icon: Link2,
    color: "text-blue-600",
    bg: "bg-blue-50",
    title: "Immutable Records",
    desc: "Every grievance is cryptographically hashed and stored on Ethereum — tamper-proof forever.",
  },
  {
    icon: Eye,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    title: "Full Transparency",
    desc: "Track your case in real time through each review stage with live blockchain status.",
  },
  {
    icon: Zap,
    color: "text-purple-600",
    bg: "bg-purple-50",
    title: "Auto Escalation",
    desc: "Missed deadlines automatically escalate your case to the next authority level.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: FileText,
    title: "Submit",
    desc: "File your grievance with details and optional attachments. Your submission is hashed and stored on-chain.",
  },
  {
    step: "02",
    icon: Bell,
    title: "Review",
    desc: "Your department committee votes. Unresolved cases auto-escalate to HoD, then Principal.",
  },
  {
    step: "03",
    icon: TrendingUp,
    title: "Resolve",
    desc: "You receive feedback and rate the resolution. All actions remain permanently auditable.",
  },
  {
    step: "04",
    icon: CheckCircle2,
    title: "Close",
    desc: "Once satisfied, the grievance is marked closed on-chain with a complete immutable audit trail.",
  },
];

export default function LandingPage() {
  return (
    <main
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #f0f4ff 0%, #e8eeff 35%, #f5f0ff 65%, #fef0ff 100%)" }}
    >
      {/* Decorative blobs */}
      <div className="absolute top-[-15%] right-[-8%] w-[36rem] h-[36rem] bg-blue-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-8%] w-[36rem] h-[36rem] bg-indigo-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-purple-200/10 rounded-full blur-3xl pointer-events-none" />

      {/* ── Nav ── */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-500/30">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-base">Grievance Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-4 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto w-full">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-blue-700 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
          Blockchain-Secured · Sepolia Testnet
        </div>

        {/* Floating icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-2xl shadow-blue-500/30 animate-float mb-8">
          <Shield className="h-10 w-10 text-white" />
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight mb-5">
          Grievances handled with{" "}
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
            zero compromise
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed mb-10">
          A transparent, tamper-proof redressal system for your institute — every action permanently
          recorded on-chain, every stakeholder held accountable.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm
                       hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
          >
            Submit a grievance
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm
                       hover:bg-white hover:border-slate-300 hover:shadow-md transition-all"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="relative z-10 px-6 pb-16 max-w-5xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
            <div
              key={title}
              className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 p-6 shadow-sm
                         hover:shadow-md hover:bg-white/90 transition-all duration-200 text-left group"
            >
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${bg} mb-4 group-hover:scale-110 transition-transform duration-200`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <p className="font-bold text-slate-900 text-sm mb-1">{title}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 px-6 pb-20 max-w-5xl mx-auto w-full">
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl border border-white/60 shadow-sm p-8 sm:p-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">How it works</h2>
            <p className="text-slate-500 text-sm mt-2">Four simple steps from submission to resolution</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }, idx) => (
              <div key={step} className="relative flex flex-col items-center text-center">
                {/* Connector line (desktop only, not last item) */}
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-[calc(50%+2.5rem)] right-[calc(-50%+2.5rem)] h-px bg-gradient-to-r from-blue-200 to-blue-100" />
                )}
                <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/25 mb-4 z-10">
                  <Icon className="h-6 w-6 text-white" />
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white border-2 border-blue-200 text-[10px] font-bold text-blue-700 flex items-center justify-center">
                    {step.slice(-1)}
                  </span>
                </div>
                <p className="font-bold text-slate-900 text-sm mb-1">{title}</p>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[160px]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 text-center pb-8 px-6">
        <p className="text-xs text-slate-400">
          Secured by blockchain · IPFS-stored attachments · Immutable audit trail
        </p>
      </footer>
    </main>
  );
}
