"use client";

import AppShell from "@/components/layout/AppShell";
import { LayoutDashboard } from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/principal/dashboard", icon: LayoutDashboard },
];

export default function PrincipalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={NAV} roleLabel="Principal Portal" pageTitle="Principal Portal">
      {children}
    </AppShell>
  );
}
