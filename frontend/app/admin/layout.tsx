"use client";

import StaffLayout from "@/components/layout/StaffLayout";
import { LayoutDashboard, Users, Settings } from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Users",     href: "/admin/users",     icon: Users },
  { label: "Settings",  href: "/admin/settings",  icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <StaffLayout nav={NAV}>{children}</StaffLayout>;
}
