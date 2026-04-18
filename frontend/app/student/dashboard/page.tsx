"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PlusCircle, RefreshCw, Inbox, FileText, TrendingUp, MessageSquare, CheckCircle2 } from "lucide-react";
import GrievanceCard from "@/components/grievance/GrievanceCard";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import type { GrievanceListItem, GrievanceStatus } from "@/types";

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function fetchMyGrievances(): Promise<GrievanceListItem[]> {
  const { data } = await api.get<GrievanceListItem[]>("/api/v1/grievances/");
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

function KpiCard({
  label,
  value,
  color,
  iconBg,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  iconBg: string;
  icon: React.ReactNode;
}) {
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            My Grievances
          </h1>
          {user && (
            <p className="text-sm text-gray-500 mt-1">
              Welcome back, <span className="font-medium text-gray-700">{user.display_name}</span>
            </p>
          )}
        </div>
        <Link
          href="/student/submit"
          className="btn-primary shrink-0"
        >
          <PlusCircle className="h-4 w-4" />
          New Grievance
        </Link>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <KpiCard
          label="Total"
          value={grievances.length}
          color="text-gray-900"
          iconBg="bg-gray-100"
          icon={<FileText className="h-5 w-5 text-gray-600" />}
        />
        <KpiCard
          label="In Progress"
          value={active}
          color="text-blue-600"
          iconBg="bg-blue-50"
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
        />
        <KpiCard
          label="Awaiting Feedback"
          value={feedback}
          color="text-purple-600"
          iconBg="bg-purple-50"
          icon={<MessageSquare className="h-5 w-5 text-purple-600" />}
        />
        <KpiCard
          label="Closed"
          value={closed}
          color="text-green-600"
          iconBg="bg-green-50"
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
        />
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <div className="flex gap-2 flex-nowrap">
          {STATUS_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilter(value as GrievanceStatus | "all")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                filter === value
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-200"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Refresh button */}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500
                     hover:text-gray-800 disabled:opacity-50 transition-colors rounded-lg hover:bg-white"
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
          className="h-28 bg-white rounded-2xl border border-gray-100 animate-shimmer"
        />
      ))}
    </div>
  );
}

function EmptyState({ hasGrievances }: { hasGrievances: boolean }) {
  return (
    <div className="card flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
        <Inbox className="h-8 w-8 text-gray-300" />
      </div>
      <p className="text-base font-semibold text-gray-700">
        {hasGrievances ? "No grievances match this filter" : "No grievances yet"}
      </p>
      <p className="text-sm text-gray-400 mt-1 max-w-xs">
        {hasGrievances
          ? "Try selecting a different filter above."
          : "Submit your first grievance to get started. All submissions are recorded on-chain."}
      </p>
      {!hasGrievances && (
        <Link
          href="/student/submit"
          className="btn-primary mt-6"
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
    <div className="card flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-3">
        <span className="text-2xl">⚠️</span>
      </div>
      <p className="text-sm font-semibold text-red-600">Failed to load grievances</p>
      <p className="text-xs text-gray-400 mt-1">There was a problem connecting to the server.</p>
      <button
        onClick={onRetry}
        className="btn-secondary mt-4 text-xs"
      >
        Try again
      </button>
    </div>
  );
}

