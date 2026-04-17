import { Shield, Link2, Eye, Zap } from "lucide-react";

const FEATURES = [
  {
    icon: Link2,
    title: "On-chain records",
    desc: "Every submission permanently stored on Ethereum Sepolia — tamper-proof forever.",
  },
  {
    icon: Eye,
    title: "Real-time tracking",
    desc: "Follow your case through each review stage with live status updates.",
  },
  {
    icon: Zap,
    title: "Auto escalation",
    desc: "Missed deadlines automatically escalate your case to higher authorities.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left branding panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[44%] xl:w-[42%] bg-slate-900 flex-col justify-between p-12 relative overflow-hidden flex-shrink-0">
        {/* Decorative glows */}
        <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[28rem] h-[28rem] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 flex-shrink-0">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Grievance Portal</span>
        </div>

        {/* Headline + feature list */}
        <div className="relative z-10 space-y-10">
          <div>
            <h2 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight">
              Transparent.<br />
              Immutable.<br />
              <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Accountable.
              </span>
            </h2>
            <p className="text-slate-400 mt-5 text-base leading-relaxed max-w-xs">
              A blockchain-backed grievance redressal platform where every action is permanently on-chain.
            </p>
          </div>

          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex-shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-slate-600 text-xs">
          © 2025 Grievance Portal · Secured by Ethereum
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
