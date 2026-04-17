"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import StaffDetailShell from "@/components/grievance/StaffDetailShell";
import ActionPanel, { ActionOption } from "@/components/grievance/ActionPanel";
import api from "@/lib/api";
import type { GrievanceDetail } from "@/types";

const PRINCIPAL_ACTIONS: ActionOption[] = [
  {
    value: "resolve",
    label: "Mark Resolved",
    color: "border-green-400 bg-green-50 text-green-700",
    desc:  "Final resolution at the highest authority level.",
  },
  {
    value: "revert",
    label: "Revert to HoD",
    color: "border-amber-400 bg-amber-50 text-amber-700",
    desc:  "Return to the Head of Department for further review or clarification.",
  },
];

export default function PrincipalGrievanceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: grievance } = useQuery({
    queryKey: ["grievance-principal", id],
    queryFn:  () =>
      api.get<GrievanceDetail>(`/api/v1/grievances/${id}`).then((r) => r.data),
    staleTime: 30_000,
  });

  const canAct = grievance?.status === "AtPrincipal";

  const actionSlot = canAct ? (
    <ActionPanel
      role="principal"
      id={id}
      actions={PRINCIPAL_ACTIONS}
      invalidateKeys={[
        ["grievance-principal", id],
        ["grievances", "principal"],
      ]}
    />
  ) : (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500 text-center">
      {grievance
        ? "This grievance is no longer at Principal stage."
        : "Loading…"}
    </div>
  );

  return (
    <StaffDetailShell
      id={id}
      backHref="/principal/dashboard"
      queryKey="grievance-principal"
      actionSlot={actionSlot}
    />
  );
}
