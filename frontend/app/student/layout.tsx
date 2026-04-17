"use client";

import AppShell from "@/components/layout/AppShell";
import { LayoutDashboard, PlusCircle } from "lucide-react";

const NAV = [
  { label: "Dashboard",        href: "/student/dashboard", icon: LayoutDashboard },
  { label: "Submit Grievance", href: "/student/submit",    icon: PlusCircle },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={NAV} roleLabel="Student Portal" pageTitle="Student Portal">
      {children}
    </AppShell>
  );
}
