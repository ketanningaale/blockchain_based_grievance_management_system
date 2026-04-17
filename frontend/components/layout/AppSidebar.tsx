"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Shield, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface AppSidebarProps {
  nav: NavItem[];
  roleLabel: string;
  open: boolean;
  onClose: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AppSidebar({ nav, roleLabel, open, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    document.cookie = "grievance_role=; path=/; max-age=0";
    router.replace("/login");
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Logo area */}
      <div className="p-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 flex-shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-white text-base leading-tight">
              Grievance Portal
            </span>
          </div>
          <div className="mt-3 ml-0.5">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/20">
              {roleLabel}
            </span>
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 mt-2 space-y-0.5">
        {nav.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-white/15 text-white border border-white/10"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Divider + user section + logout */}
      <div className="border-t border-slate-700/50 mt-auto p-4 space-y-3">
        {/* User info */}
        {user && (
          <div className="flex items-center gap-3 px-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0 text-white text-xs font-bold">
              {getInitials(user.display_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{user.display_name}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:flex-shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          {/* Drawer */}
          <div className="relative z-50 flex flex-col w-64 flex-shrink-0">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
