"use client";

import StaffLayout from "@/components/layout/StaffLayout";
import { LayoutDashboard } from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/hod/dashboard", icon: LayoutDashboard },
];

export default function HoDLayout({ children }: { children: React.ReactNode }) {
  return <StaffLayout nav={NAV}>{children}</StaffLayout>;
}
