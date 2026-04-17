"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  LogOut,
  Menu,
  X,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const NAV = [
  { label: "Dashboard",       href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Submit Grievance", href: "/student/submit",   icon: PlusCircle },
];

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname     = usePathname();
  const router       = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    // Clear the role cookie so middleware doesn't redirect back
    document.cookie = "grievance_role=; path=/; max-age=0";
    router.replace("/login");
  };

  return (
    <div className="min-h-screen gradient-page flex flex-col">
      {/* ── Top navbar ────────────────────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Brand */}
          <Link href="/student/dashboard" className="flex items-center gap-2.5 font-bold text-gray-900 hover:opacity-80 transition-opacity">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-brand shadow-sm">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
              Grievance Portal
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                  pathname === href || pathname.startsWith(href + "/")
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-100 shadow-sm"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          {/* Right side: user + logout */}
          <div className="flex items-center gap-2">
            {user && (
              <span className="hidden sm:block text-sm font-medium text-gray-700 px-2">
                {user.display_name}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                         text-gray-600 hover:bg-red-50 hover:text-red-600 border border-transparent
                         hover:border-red-100 transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <nav className="sm:hidden border-t border-gray-200/60 px-4 py-3 space-y-1 bg-white/95 backdrop-blur-md">
            {NAV.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  pathname === href
                    ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-100"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2.5 rounded-xl text-sm
                         text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </nav>
        )}
      </header>

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
