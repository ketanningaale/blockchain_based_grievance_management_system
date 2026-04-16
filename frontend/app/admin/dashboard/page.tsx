"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import api from "@/lib/api";
import { statusLabel } from "@/lib/utils";
import type { AnalyticsOverview, DeptBreakdown } from "@/types";

// ── Fetch ──────────────────────────────────────────────────────────────────────

const fetchOverview  = () => api.get<AnalyticsOverview>("/api/v1/admin/analytics/overview").then((r) => r.data);
const fetchByDept    = () => api.get<DeptBreakdown[]>("/api/v1/admin/analytics/by-dept").then((r) => r.data);

// ── Pie colours — one per status ───────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  AtCommittee:      "#3b82f6",
  AtHoD:            "#eab308",
  AtPrincipal:      "#f97316",
  AwaitingFeedback: "#a855f7",
  Closed:           "#22c55e",
  Debarred:         "#ef4444",
  Submitted:        "#6b7280",
};

// ── KPI card ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const {
    data: overview,
    isLoading: ovLoading,
    refetch: refetchOv,
    isFetching: ovFetching,
  } = useQuery({ queryKey: ["admin-overview"], queryFn: fetchOverview, staleTime: 30_000 });

  const {
    data: byDept = [],
    isLoading: deptLoading,
  } = useQuery({ queryKey: ["admin-by-dept"], queryFn: fetchByDept, staleTime: 30_000 });

  // Build pie data from by_status map
  const pieData = overview
    ? Object.entries(overview.by_status).map(([status, count]) => ({
        name:  statusLabel(status),
        value: count,
        fill:  STATUS_COLORS[status] ?? "#6b7280",
      }))
    : [];

  // Bar data
  const barData = byDept.map((d) => ({
    name:     d.department.length > 14 ? d.department.slice(0, 12) + "…" : d.department,
    fullName: d.department,
    Total:    d.total,
    Resolved: d.resolved,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Overview</h1>
        <button
          onClick={() => refetchOv()}
          disabled={ovFetching}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600
                     hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${ovFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPI row */}
      {ovLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-white border border-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Kpi label="Total"            value={overview.total}             color="text-gray-900"   />
          <Kpi label="In Progress"      value={overview.pending}           color="text-blue-600"   />
          <Kpi label="Resolved"         value={overview.resolved}          color="text-green-600"  />
          <Kpi label="Awaiting Feedback" value={overview.awaiting_feedback} color="text-purple-600" />
          <Kpi label="Debarred"         value={overview.debarred}          color="text-red-600"    />
        </div>
      ) : null}

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Pie: by status */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
            By Status
          </h2>
          {ovLoading ? (
            <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
          ) : pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "grievances"]} />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">
              No data yet
            </div>
          )}
        </div>

        {/* Bar: by department */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
            By Department
          </h2>
          {deptLoading ? (
            <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
          ) : barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(label) =>
                    barData.find((d) => d.name === label)?.fullName ?? label
                  }
                />
                <Legend iconType="square" iconSize={10} />
                <Bar dataKey="Total"    fill="#93c5fd" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Resolved" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">
              No department data yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
