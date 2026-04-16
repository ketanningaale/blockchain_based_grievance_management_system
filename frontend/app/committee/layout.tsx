import StaffLayout from "@/components/layout/StaffLayout";
import { LayoutDashboard } from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/committee/dashboard", icon: LayoutDashboard },
];

export default function CommitteeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StaffLayout nav={NAV}>{children}</StaffLayout>;
}
