"use client";

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
  student:   "bg-gray-100 text-gray-700",
  committee: "bg-blue-100 text-blue-700",
  hod:       "bg-yellow-100 text-yellow-700",
  principal: "bg-orange-100 text-orange-700",
  admin:     "bg-red-100 text-red-700",
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
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">{user.display_name}</p>
        <p className="text-xs text-gray-500">{user.email}</p>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{user.department || "—"}</td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
              className="text-sm border border-gray-300 rounded-lg px-2 py-1
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button
              onClick={handleSave}
              disabled={busy}
              className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg
                         hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setNewRole(user.role); }}
              className="text-xs px-2 py-1 border border-gray-300 rounded-lg
                         hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
              "hover:opacity-80 transition-opacity cursor-pointer",
              ROLE_COLORS[user.role]
            )}
          >
            {user.role}
            <UserCog className="h-3 w-3" />
          </button>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onDelete(user.uid)}
          disabled={busy}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600
                     disabled:opacity-50 transition-colors"
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
      api.post("/api/v1/admin/users", { uid, role }),
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
          />
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600
                       hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Role badge legend */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <span key={r} className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", ROLE_COLORS[r])}>
            {r} · {users.filter((u) => u.role === r).length}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-red-600">
            Failed to load users.{" "}
            <button onClick={() => refetch()} className="text-blue-600 hover:underline">Retry</button>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">
                    {search ? "No users match your search." : "No users found."}
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
