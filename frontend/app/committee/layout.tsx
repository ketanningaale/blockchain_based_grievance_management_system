"use client";

import AppShell from "@/components/layout/AppShell";
import { LayoutDashboard } from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/committee/dashboard", icon: LayoutDashboard },
];

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={NAV} roleLabel="Committee Portal" pageTitle="Committee Portal">
      {children}
    </AppShell>
  );
}
