"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import StaffDetailShell from "@/components/grievance/StaffDetailShell";
import ActionPanel, { ActionOption } from "@/components/grievance/ActionPanel";
import api from "@/lib/api";
import type { GrievanceDetail } from "@/types";

const HOD_ACTIONS: ActionOption[] = [
  {
    value: "forward",
    label: "Forward to Principal",
    color: "border-blue-400 bg-blue-50 text-blue-700",
    desc:  "Escalate the grievance to the Principal for final decision.",
  },
  {
    value: "resolve",
    label: "Mark Resolved",
    color: "border-green-400 bg-green-50 text-green-700",
    desc:  "Grievance has been satisfactorily addressed at HoD level.",
  },
  {
    value: "revert",
    label: "Revert to Committee",
    color: "border-amber-400 bg-amber-50 text-amber-700",
    desc:  "Send back for further investigation or additional information.",
  },
];

export default function HoDGrievanceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: grievance } = useQuery({
    queryKey: ["grievance-hod", id],
    queryFn:  () =>
      api.get<GrievanceDetail>(`/api/v1/grievances/${id}`).then((r) => r.data),
    staleTime: 30_000,
  });

  const canAct = grievance?.status === "AtHoD";

  const actionSlot = canAct ? (
    <ActionPanel
      role="hod"
      id={id}
      actions={HOD_ACTIONS}
      invalidateKeys={[
        ["grievance-hod", id],
        ["grievances", "hod"],
      ]}
    />
  ) : (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500 text-center">
      {grievance
        ? "This grievance is no longer at HoD stage."
        : "Loading…"}
    </div>
  );

  return (
    <StaffDetailShell
      id={id}
      backHref="/hod/dashboard"
      queryKey="grievance-hod"
      actionSlot={actionSlot}
    />
  );
}
