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
    <div className="card-elevated overflow-hidden">
      {/* Gradient top border accent */}
      <div className="h-1 gradient-brand" />
      <div className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-gray-900">Escalation Thresholds</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Stored on-chain. The APScheduler watchdog checks every 30 minutes and
            auto-forwards overdue grievances.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={form[key]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                    }
                    className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm text-right
                               focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white transition-all"
                  />
                  <span className="text-xs font-medium text-gray-500 whitespace-nowrap">hrs</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => save()}
          disabled={isPending || isLoading}
          className="btn-primary"
        >
          {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Thresholds</>}
        </button>
      </div>
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
    <div className="card-elevated overflow-hidden">
      {/* Gradient top border accent */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
      <div className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-gray-900">Departments</h2>
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
            className="input-base flex-1"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newDept.trim()}
            className="btn-primary shrink-0"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 rounded-xl" />
            ))}
          </div>
        ) : departments.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-2">
              <Plus className="h-5 w-5 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">No departments configured yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {departments.map((dept) => (
              <li
                key={dept}
                className="flex items-center justify-between px-4 py-3 bg-gray-50
                           rounded-xl border border-gray-100 hover:border-gray-200 transition-colors group"
              >
                <span className="text-sm font-medium text-gray-800">{dept}</span>
                <button
                  onClick={() => removeDept(dept)}
                  disabled={removing}
                  className="p-1.5 rounded-lg text-gray-300 group-hover:text-gray-400 hover:bg-red-50 hover:text-red-500
                             disabled:opacity-50 transition-all duration-200"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">Configure on-chain thresholds and system departments</p>
      </div>
      <ThresholdsPanel />
      <DepartmentsPanel />
    </div>
  );
}
