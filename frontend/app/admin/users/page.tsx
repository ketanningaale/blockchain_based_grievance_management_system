"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import type { UserProfile, Role } from "@/types";

// ── Fetch / mutate ─────────────────────────────────────────────────────────────

const fetchUsers = () => api.get<UserProfile[]>("/api/v1/admin/users").then((r) => r.data);

const ROLES: Role[] = ["student", "committee", "hod", "principal", "admin"];

const ROLE_COLORS: Record<Role, string> = {
  student:   "bg-gray-100 text-gray-700 border border-gray-200",
  committee: "bg-blue-100 text-blue-700 border border-blue-200",
  hod:       "bg-amber-100 text-amber-700 border border-amber-200",
  principal: "bg-orange-100 text-orange-700 border border-orange-200",
  admin:     "bg-red-100 text-red-700 border border-red-200",
};

// ── Row ────────────────────────────────────────────────────────────────────────

function UserRow({
  user,
  onRoleChange,
  onDelete,
  busy,
}: {
  user:         UserProfile;
  onRoleChange: (uid: string, role: Role) => void;
  onDelete:     (uid: string) => void;
  busy:         boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [newRole, setNewRole] = useState<Role>(user.role);

  const handleSave = () => {
    if (newRole !== user.role) onRoleChange(user.uid, newRole);
    setEditing(false);
  };

  return (
    <tr className="border-b border-gray-50 hover:bg-blue-50/30 transition-all duration-150 group">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{user.display_name}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 text-sm text-gray-600">{user.department || <span className="text-gray-300">—</span>}</td>
      <td className="px-4 py-3.5">
        {editing ? (
          <div className="flex items-center gap-2">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5
                         focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              onClick={handleSave}
              disabled={busy}
              className="text-xs px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg
                         hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
            >
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setNewRole(user.role); }}
              className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg
                         hover:bg-gray-100 transition-colors text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={cn(
              "badge font-semibold hover:opacity-80 transition-opacity cursor-pointer",
              ROLE_COLORS[user.role]
            )}
          >
            {user.role}
            <UserCog className="h-3 w-3" />
          </button>
        )}
      </td>
      <td className="px-4 py-3.5 text-right">
        <button
          onClick={() => onDelete(user.uid)}
          disabled={busy}
          className="p-2 rounded-xl text-gray-300 group-hover:text-gray-400 hover:bg-red-50 hover:text-red-600
                     disabled:opacity-50 transition-all duration-200"
          title="Remove user"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const {
    data: users = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({ queryKey: ["admin-users"], queryFn: fetchUsers, staleTime: 30_000 });

  const { mutate: assignRole, isPending: assigning } = useMutation({
    mutationFn: ({ uid, role }: { uid: string; role: Role }) =>
      api.post(`/api/v1/admin/users/${uid}/role`, { role }),
    onSuccess: () => {
      toast.success("Role updated. User tokens revoked — they must sign in again.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: deleteUser, isPending: deleting } = useMutation({
    mutationFn: (uid: string) => api.delete(`/api/v1/admin/users/${uid}`),
    onSuccess: () => {
      toast.success("User removed.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const confirmDelete = (uid: string) => {
    const user = users.find((u) => u.uid === uid);
    if (!user) return;
    if (!window.confirm(`Remove ${user.display_name} (${user.email})? This cannot be undone.`)) return;
    deleteUser(uid);
  };

  const filtered = users.filter(
    (u) =>
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.department?.toLowerCase().includes(search.toLowerCase())
  );

  const busy = assigning || deleting;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            User Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage roles and access for all system users</p>
        </div>
      </div>

      {/* Search + stats card */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <input
              type="search"
              placeholder="Search by name, email or department…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base pl-9"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
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

        {/* Role badge legend */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          {ROLES.map((r) => (
            <span key={r} className={cn("badge font-semibold", ROLE_COLORS[r])}>
              {r} <span className="opacity-60 ml-0.5">{users.filter((u) => u.role === r).length}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card-elevated overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-sm text-red-600 font-medium">Failed to load users.</p>
            <button onClick={() => refetch()} className="mt-2 text-sm text-blue-600 hover:underline">Retry</button>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50/80 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                        <UserCog className="h-6 w-6 text-gray-300" />
                      </div>
                      <p className="text-sm text-gray-500 font-medium">
                        {search ? "No users match your search." : "No users found."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <UserRow
                    key={u.uid}
                    user={u}
                    onRoleChange={(uid, role) => assignRole({ uid, role })}
                    onDelete={confirmDelete}
                    busy={busy}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Changing a role immediately revokes the user&apos;s active tokens — they will need to sign in again to receive the new role.
      </p>
    </div>
  );
}
