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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Top navbar ────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Brand */}
          <Link href="/student/dashboard" className="flex items-center gap-2 font-semibold text-gray-900">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Grievance Portal</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  pathname === href || pathname.startsWith(href + "/")
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
              <span className="hidden sm:block text-sm text-gray-600">
                {user.display_name}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                         text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <nav className="sm:hidden border-t border-gray-200 px-4 py-3 space-y-1 bg-white">
            {NAV.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === href
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm
                         text-gray-700 hover:bg-gray-100 transition-colors"
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
