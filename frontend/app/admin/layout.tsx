"use client";

import AppShell from "@/components/layout/AppShell";
import { LayoutDashboard, Users, Settings } from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users",     href: "/admin/users",     icon: Users },
  { label: "Settings",  href: "/admin/settings",  icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={NAV} roleLabel="Admin Portal" pageTitle="Admin Portal">
      {children}
    </AppShell>
  );
}
