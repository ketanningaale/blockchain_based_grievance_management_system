"use client";

import AppShell from "@/components/layout/AppShell";
import { LayoutDashboard } from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/hod/dashboard", icon: LayoutDashboard },
];

export default function HoDLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={NAV} roleLabel="HoD Portal" pageTitle="HoD Portal">
      {children}
    </AppShell>
  );
}
