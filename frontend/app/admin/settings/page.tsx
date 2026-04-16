"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, X, Save } from "lucide-react";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Thresholds {
  committee_threshold_hours: number;
  hod_threshold_hours:       number;
  principal_threshold_hours: number;
}

// ── Fetch ──────────────────────────────────────────────────────────────────────

const fetchThresholds  = () => api.get<Thresholds>("/api/v1/admin/thresholds").then((r) => r.data);
const fetchDepartments = () => api.get<string[]>("/api/v1/admin/departments").then((r) => r.data);

// ── Threshold form ─────────────────────────────────────────────────────────────

function ThresholdsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-thresholds"],
    queryFn:  fetchThresholds,
    staleTime: 60_000,
  });

  const [form, setForm] = useState<Thresholds>({
    committee_threshold_hours: 72,
    hod_threshold_hours:       48,
    principal_threshold_hours: 48,
  });

  // Sync server data into local form once loaded
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.put("/api/v1/admin/thresholds", form),
    onSuccess:  () => {
      toast.success("Thresholds updated on-chain.");
      qc.invalidateQueries({ queryKey: ["admin-thresholds"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const fields: { key: keyof Thresholds; label: string; desc: string }[] = [
    {
      key:   "committee_threshold_hours",
      label: "Committee threshold",
      desc:  "Hours before a grievance at Committee is auto-forwarded to HoD",
    },
    {
      key:   "hod_threshold_hours",
      label: "HoD threshold",
      desc:  "Hours before a grievance at HoD is auto-forwarded to Principal",
    },
    {
      key:   "principal_threshold_hours",
      label: "Principal threshold",
      desc:  "Hours before the admin is alerted if Principal hasn't acted",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Escalation Thresholds</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Stored on-chain. The APScheduler watchdog checks every 30 minutes and
          auto-forwards overdue grievances.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map(({ key, label, desc }) => (
            <div key={key} className="grid sm:grid-cols-3 items-center gap-3">
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                  }
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">hours</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => save()}
        disabled={isPending || isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg
                   text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Thresholds</>}
      </button>
    </div>
  );
}

// ── Departments panel ──────────────────────────────────────────────────────────

function DepartmentsPanel() {
  const qc = useQueryClient();
  const [newDept, setNewDept] = useState("");

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["admin-departments"],
    queryFn:  fetchDepartments,
    staleTime: 60_000,
  });

  const { mutate: addDept, isPending: adding } = useMutation({
    mutationFn: (name: string) => api.post("/api/v1/admin/departments", { name }),
    onSuccess:  () => {
      toast.success("Department added.");
      setNewDept("");
      qc.invalidateQueries({ queryKey: ["admin-departments"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: removeDept, isPending: removing } = useMutation({
    mutationFn: (name: string) => api.delete("/api/v1/admin/departments", { data: { name } }),
    onSuccess:  () => {
      toast.success("Department removed.");
      qc.invalidateQueries({ queryKey: ["admin-departments"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleAdd = () => {
    const name = newDept.trim();
    if (!name) return;
    if (departments.includes(name)) {
      toast.error("Department already exists.");
      return;
    }
    addDept(name);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Departments</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Used to scope grievances and committee assignments per department.
        </p>
      </div>

      {/* Add form */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="New department name…"
          value={newDept}
          onChange={(e) => setNewDept(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newDept.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg
                     text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-50 rounded-lg" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No departments configured yet.</p>
      ) : (
        <ul className="space-y-2">
          {departments.map((dept) => (
            <li
              key={dept}
              className="flex items-center justify-between px-3 py-2.5 bg-gray-50
                         rounded-lg border border-gray-200"
            >
              <span className="text-sm text-gray-800">{dept}</span>
              <button
                onClick={() => removeDept(dept)}
                disabled={removing}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600
                           disabled:opacity-50 transition-colors"
                title="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <ThresholdsPanel />
      <DepartmentsPanel />
    </div>
  );
}
