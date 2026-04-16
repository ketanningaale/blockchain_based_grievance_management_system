"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Inbox } from "lucide-react";
import GrievanceCard from "@/components/grievance/GrievanceCard";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import type { GrievanceListItem } from "@/types";

async function fetchPrincipalGrievances(): Promise<GrievanceListItem[]> {
  const { data } = await api.get<GrievanceListItem[]>("/api/v1/grievances");
  return data;
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export default function PrincipalDashboardPage() {
  const { user } = useAuth();

  const {
    data: grievances = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["grievances", "principal"],
    queryFn:  fetchPrincipalGrievances,
    staleTime: 30_000,
  });

  const now     = Math.floor(Date.now() / 1000);
  const pending = grievances.filter((g) => g.status === "AtPrincipal").length;
  const overdue = grievances.filter(
    (g) => g.status === "AtPrincipal" && g.threshold_deadline < now
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Principal Dashboard</h1>
          {user && (
            <p className="text-sm text-gray-500 mt-0.5">{user.display_name}</p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600
                     hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="Total Received"  value={grievances.length} color="text-gray-900" />
        <KpiCard label="Awaiting Action" value={pending}           color="text-orange-600" />
        <KpiCard label="Overdue"         value={overdue}           color="text-red-600"   />
      </div>

      {/* List */}
      {isLoading ? (
        <Skeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : grievances.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Grievances escalated to the Principal
          </p>
          {grievances.map((g) => (
            <GrievanceCard
              key={g.id}
              grievance={g}
              detailBase="/principal/grievance"
              showStudent
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-28 bg-white rounded-xl border border-gray-200 animate-pulse" />
      ))}
    </div>
  );
}
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Inbox className="h-10 w-10 text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-700">No grievances escalated to you yet</p>
    </div>
  );
}
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-sm text-red-600 font-medium">Failed to load grievances</p>
      <button onClick={onRetry} className="mt-3 text-sm text-blue-600 hover:underline">Try again</button>
    </div>
  );
}
