"use client";

export const dynamic = "force-dynamic";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, BarChart2, TrendingUp, CheckCircle2, MessageSquare, AlertTriangle, FileText } from "lucide-react";
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

function Kpi({
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
    <div className="stat-card">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${iconBg} mb-3`}>
        {icon}
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 font-medium">{label}</p>
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Analytics Overview
          </h1>
          <p className="text-sm text-gray-500 mt-1">Real-time system metrics and grievance statistics</p>
        </div>
        <button
          onClick={() => refetchOv()}
          disabled={ovFetching}
          className="btn-secondary text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${ovFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* KPI row */}
      {ovLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-white border border-gray-100 rounded-2xl animate-shimmer" />
          ))}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Kpi
            label="Total"
            value={overview.total}
            color="text-gray-900"
            iconBg="bg-gray-100"
            icon={<FileText className="h-5 w-5 text-gray-600" />}
          />
          <Kpi
            label="In Progress"
            value={overview.pending}
            color="text-blue-600"
            iconBg="bg-blue-50"
            icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          />
          <Kpi
            label="Resolved"
            value={overview.resolved}
            color="text-green-600"
            iconBg="bg-green-50"
            icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          />
          <Kpi
            label="Awaiting Feedback"
            value={overview.awaiting_feedback}
            color="text-purple-600"
            iconBg="bg-purple-50"
            icon={<MessageSquare className="h-5 w-5 text-purple-600" />}
          />
          <Kpi
            label="Debarred"
            value={overview.debarred}
            color="text-red-600"
            iconBg="bg-red-50"
            icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          />
        </div>
      ) : null}

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Pie: by status */}
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <BarChart2 className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">By Status</h2>
          </div>
          {ovLoading ? (
            <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
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
            <div className="h-64 flex flex-col items-center justify-center text-sm text-gray-400 gap-2">
              <BarChart2 className="h-8 w-8 text-gray-200" />
              No data yet
            </div>
          )}
        </div>

        {/* Bar: by department */}
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
              <BarChart2 className="h-4 w-4 text-indigo-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">By Department</h2>
          </div>
          {deptLoading ? (
            <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
          ) : barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(label) =>
                    barData.find((d) => d.name === label)?.fullName ?? label
                  }
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)" }}
                />
                <Legend iconType="square" iconSize={10} />
                <Bar dataKey="Total"    fill="#93c5fd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Resolved" fill="#4ade80" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-sm text-gray-400 gap-2">
              <BarChart2 className="h-8 w-8 text-gray-200" />
              No department data yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
