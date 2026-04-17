"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Inbox, FileText, Clock, AlertTriangle } from "lucide-react";
import GrievanceCard from "@/components/grievance/GrievanceCard";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import type { GrievanceListItem } from "@/types";

async function fetchPrincipalGrievances(): Promise<GrievanceListItem[]> {
  const { data } = await api.get<GrievanceListItem[]>("/api/v1/grievances");
  return data;
}

function KpiCard({ label, value, color, iconBg, icon }: { label: string; value: number; color: string; iconBg: string; icon: React.ReactNode }) {
  return (
    <div className="stat-card flex flex-col gap-3">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${iconBg}`}>
        {icon}
      </div>
      <div>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
      </div>
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Principal Dashboard
          </h1>
          {user && (
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-medium text-gray-700">{user.display_name}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-secondary text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total Received"  value={grievances.length} color="text-gray-900"    iconBg="bg-gray-100"   icon={<FileText className="h-5 w-5 text-gray-600" />} />
        <KpiCard label="Awaiting Action" value={pending}           color="text-orange-600"  iconBg="bg-orange-50"  icon={<Clock className="h-5 w-5 text-orange-500" />} />
        <KpiCard label="Overdue"         value={overdue}           color="text-red-600"     iconBg="bg-red-50"     icon={<AlertTriangle className="h-5 w-5 text-red-500" />} />
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
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
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
        <div key={i} className="h-28 bg-white rounded-2xl border border-gray-100 animate-shimmer" />
      ))}
    </div>
  );
}
function EmptyState() {
  return (
    <div className="card flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
        <Inbox className="h-8 w-8 text-gray-300" />
      </div>
      <p className="text-base font-semibold text-gray-700">No grievances escalated to you yet</p>
      <p className="text-sm text-gray-400 mt-1">Grievances from the HoD will appear here when escalated.</p>
    </div>
  );
}
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center py-20 text-center px-6">
      <p className="text-sm text-red-600 font-semibold">Failed to load grievances</p>
      <button onClick={onRetry} className="mt-3 text-sm text-blue-600 hover:underline font-medium">Try again</button>
    </div>
  );
}
