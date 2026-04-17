"use client";

import { useState } from "react";
import { Menu, Bell } from "lucide-react";
import AppSidebar, { type NavItem } from "./AppSidebar";
import { useAuth } from "@/hooks/useAuth";

interface AppShellProps {
  nav: NavItem[];
  roleLabel: string;
  pageTitle: string;
  children: React.ReactNode;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AppShell({ nav, roleLabel, pageTitle, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <AppSidebar
        nav={nav}
        roleLabel={roleLabel}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between flex-shrink-0 z-20">
          {/* Left: hamburger (mobile) + page title */}
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-bold text-slate-900">{pageTitle}</h1>
          </div>

          {/* Right: notification bell + user avatar */}
          <div className="flex items-center gap-3">
            <button
              className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all relative"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold flex-shrink-0 cursor-default select-none">
              {user ? getInitials(user.display_name) : "?"}
            </div>
          </div>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
