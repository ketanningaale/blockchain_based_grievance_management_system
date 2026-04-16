"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

export interface ActionOption {
  value:  string;
  label:  string;
  color:  string;   // selected Tailwind classes
  desc:   string;
}

interface ActionPanelProps {
  /** e.g. "hod" or "principal" — used to build /api/v1/{role}/{id}/action */
  role:     string;
  id:       string;
  actions:  ActionOption[];
  /** Keys of TanStack queries to invalidate after a successful action */
  invalidateKeys?: string[][];
}

/**
 * Shared single-actor action panel used by HoD and Principal detail pages.
 * Renders action option cards + remarks textarea, POSTs to /api/v1/{role}/{id}/action.
 */
export default function ActionPanel({
  role,
  id,
  actions,
  invalidateKeys = [],
}: ActionPanelProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [remarks,  setRemarks]  = useState("");
  const [done,     setDone]     = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/${role}/${id}/action`, { action: selected, remarks }),
    onSuccess: () => {
      toast.success("Action recorded on-chain.");
      setDone(true);
      invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 font-medium text-center">
        Action submitted. The grievance status has been updated.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Take Action
      </h2>

      {/* Action cards */}
      <div className="space-y-2">
        {actions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSelected(opt.value)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border-2 transition-colors",
              selected === opt.value
                ? opt.color
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            )}
          >
            <p className="text-sm font-semibold">{opt.label}</p>
            <p className="text-xs opacity-70 mt-0.5">{opt.desc}</p>
          </button>
        ))}
      </div>

      {/* Remarks */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-600">
          Remarks <span className="text-gray-400">(required — stored on IPFS)</span>
        </label>
        <textarea
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Provide your reasoning or decision notes…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <button
        onClick={() => mutate()}
        disabled={!selected || !remarks.trim() || isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white
                   rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isPending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
          : <><Send className="h-4 w-4" /> Submit Action</>}
      </button>
    </div>
  );
}
