"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, RefreshCw, Inbox } from "lucide-react";
import GrievanceCard from "@/components/grievance/GrievanceCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import type { GrievanceListItem, GrievanceStatus } from "@/types";

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function fetchMyGrievances(): Promise<GrievanceListItem[]> {
  const { data } = await api.get<GrievanceListItem[]>("/api/v1/grievances");
  return data;
}

// ── Status filter tabs ────────────────────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: GrievanceStatus | "all" }[] = [
  { label: "All",              value: "all" },
  { label: "Active",          value: "AtCommittee" },       // used as proxy for "not done"
  { label: "Awaiting Me",     value: "AwaitingFeedback" },
  { label: "Closed",          value: "Closed" },
  { label: "Debarred",        value: "Debarred" },
];

// ── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StudentDashboardPage() {
  const { user } = useAuth();

  const {
    data: grievances = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["grievances", "student"],
    queryFn:  fetchMyGrievances,
    staleTime: 30_000,
  });

  // ── Derived counts ────────────────────────────────────────────────────────

  const active   = grievances.filter((g) =>
    ["AtCommittee", "AtHoD", "AtPrincipal", "Submitted"].includes(g.status)
  ).length;
  const feedback = grievances.filter((g) => g.status === "AwaitingFeedback").length;
  const closed   = grievances.filter((g) => g.status === "Closed").length;

  // ── Local filter state ────────────────────────────────────────────────────

  const [filter, setFilter] = useState<GrievanceStatus | "all">("all");

  const displayed = filter === "all"
    ? grievances
    : filter === "AtCommittee"
    // "Active" means anything in the pipeline (not terminal)
    ? grievances.filter((g) =>
        ["AtCommittee", "AtHoD", "AtPrincipal", "Submitted"].includes(g.status)
      )
    : grievances.filter((g) => g.status === filter);

  return (
    <div className="space-y-6">
      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Grievances</h1>
          {user && (
            <p className="text-sm text-gray-500 mt-0.5">
              Welcome back, {user.display_name}
            </p>
          )}
        </div>
        <Link
          href="/student/submit"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                     text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          New Grievance
        </Link>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total"            value={grievances.length} color="text-gray-900" />
        <KpiCard label="In Progress"      value={active}            color="text-blue-600"  />
        <KpiCard label="Awaiting Feedback" value={feedback}          color="text-purple-600" />
        <KpiCard label="Closed"           value={closed}            color="text-green-600" />
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value as GrievanceStatus | "all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === value
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300"
            }`}
          >
            {label}
          </button>
        ))}

        {/* Refresh button */}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500
                     hover:text-gray-800 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── List ───────────────────────────────────────────────────────── */}
      {isLoading ? (
        <GrievanceSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : displayed.length === 0 ? (
        <EmptyState hasGrievances={grievances.length > 0} />
      ) : (
        <div className="space-y-3">
          {displayed.map((g) => (
            <GrievanceCard
              key={g.id}
              grievance={g}
              detailBase="/student/grievance"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inline sub-components (small, page-specific) ──────────────────────────────

function GrievanceSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="h-28 bg-white rounded-xl border border-gray-200 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState({ hasGrievances }: { hasGrievances: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Inbox className="h-10 w-10 text-gray-300 mb-3" />
      <p className="text-sm font-medium text-gray-700">
        {hasGrievances ? "No grievances match this filter" : "No grievances yet"}
      </p>
      {!hasGrievances && (
        <Link
          href="/student/submit"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                     rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Submit your first grievance
        </Link>
      )}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-sm text-red-600 font-medium">Failed to load grievances</p>
      <button
        onClick={onRetry}
        className="mt-3 text-sm text-blue-600 hover:underline"
      >
        Try again
      </button>
    </div>
  );
}

