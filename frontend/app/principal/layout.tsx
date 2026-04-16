"use client";

import StaffLayout from "@/components/layout/StaffLayout";
import { LayoutDashboard } from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/principal/dashboard", icon: LayoutDashboard },
];

export default function PrincipalLayout({ children }: { children: React.ReactNode }) {
  return <StaffLayout nav={NAV}>{children}</StaffLayout>;
}
