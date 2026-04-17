"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  Loader2,
  Send,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Paperclip,
  Users,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { cn, ipfsUrl, statusLabel, timeAgo } from "@/lib/utils";
import api from "@/lib/api";
import type { GrievanceDetail, VoteTally, ActionHistoryItem } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

type CommitteeAction = "forward" | "resolve" | "debar";

interface IPFSContent {
  title:       string;
  description: string;
  attachments: { name: string; cid: string; mime_type: string }[];
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

const fetchDetail = (id: string) =>
  api.get<GrievanceDetail>(`/api/v1/grievances/${id}`).then((r) => r.data);

const fetchTally = (id: string) =>
  api.get<VoteTally>(`/api/v1/committee/${id}/votes`).then((r) => r.data);

const fetchIPFS = async (cid: string): Promise<IPFSContent> => {
  const res = await fetch(ipfsUrl(cid));
  if (!res.ok) throw new Error("Could not load content");
  return res.json();
};

// ── Tally bar ─────────────────────────────────────────────────────────────────

function TallyBar({ tally }: { tally: VoteTally }) {
  const total   = tally.yesCount + tally.noCount;
  const yesPct  = total > 0 ? Math.round((tally.yesCount / total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <Users className="h-4 w-4" />
          Current Vote Tally
        </h2>
        {tally.executed && (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Executed
          </span>
        )}
      </div>

      {tally.proposedAction ? (
        <>
          <p className="text-sm text-gray-600">
            Proposed action:{" "}
            <span className="font-semibold text-gray-900">{tally.proposedAction}</span>
            {" · "}
            <span className="text-gray-500">
              {tally.yesCount} yes / {tally.noCount} no (need {tally.majorityNeeded} to execute)
            </span>
          </p>

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${yesPct}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500">
            <span>{tally.yesCount} in favour</span>
            <span>{tally.noCount} against</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 italic">No votes cast yet.</p>
      )}
    </div>
  );
}

// ── Propose panel ─────────────────────────────────────────────────────────────

const ACTION_OPTIONS: { value: CommitteeAction; label: string; color: string; desc: string }[] = [
  {
    value: "forward",
    label: "Forward to HoD",
    color: "border-blue-400 bg-blue-50 text-blue-700",
    desc:  "Escalate the grievance to the Head of Department for further review.",
  },
  {
    value: "resolve",
    label: "Mark Resolved",
    color: "border-green-400 bg-green-50 text-green-700",
    desc:  "Grievance has been satisfactorily addressed at committee level.",
  },
  {
    value: "debar",
    label: "Debar",
    color: "border-red-400 bg-red-50 text-red-700",
    desc:  "Mark as invalid / malicious. This is irreversible once executed.",
  },
];

function ProposePanel({
  id,
  tally,
  onVoted,
}: {
  id: string;
  tally: VoteTally | undefined;
  onVoted: () => void;
}) {
  const qc = useQueryClient();
  const [action,  setAction]  = useState<CommitteeAction | null>(null);
  const [remarks, setRemarks] = useState("");

  const propose = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("action", action ?? "");
      form.append("remarks", remarks);
      return api.post(`/api/v1/committee/${id}/propose`, form);
    },
    onSuccess: () => {
      toast.success("Vote cast on-chain.");
      setRemarks("");
      onVoted();
      qc.invalidateQueries({ queryKey: ["committee-tally", id] });
      qc.invalidateQueries({ queryKey: ["grievance", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const execute = useMutation({
    mutationFn: () => api.post(`/api/v1/committee/${id}/execute`, {}),
    onSuccess: () => {
      toast.success("Action executed on-chain.");
      qc.invalidateQueries({ queryKey: ["committee-tally", id] });
      qc.invalidateQueries({ queryKey: ["grievance", id] });
      qc.invalidateQueries({ queryKey: ["grievances", "committee"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const majorityReached =
    tally &&
    !tally.executed &&
    tally.yesCount >= tally.majorityNeeded;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Cast Your Vote
      </h2>

      {/* Action selector */}
      <div className="space-y-2">
        {ACTION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setAction(opt.value)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border-2 transition-colors",
              action === opt.value
                ? opt.color
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
            )}
          >
            <p className="text-sm font-semibold">{opt.label}</p>
            <p className="text-xs text-current opacity-70 mt-0.5">{opt.desc}</p>
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
          placeholder="Explain your reasoning…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Vote button */}
      <button
        onClick={() => propose.mutate()}
        disabled={!action || !remarks.trim() || propose.isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white
                   rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {propose.isPending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
          : <><Send className="h-4 w-4" /> Cast Vote</>}
      </button>

      {/* Execute button — only when majority reached */}
      {majorityReached && (
        <button
          onClick={() => execute.mutate()}
          disabled={execute.isPending}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white
                     rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {execute.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Executing…</>
            : <><CheckCircle2 className="h-4 w-4" /> Execute ({tally?.proposedAction})</>}
        </button>
      )}
    </div>
  );
}

// ── Action history ────────────────────────────────────────────────────────────

function Timeline({ history }: { history: ActionHistoryItem[] }) {
  if (!history.length) return null;

  const actionLabel = (a: string) =>
    ({
      Submitted:     "Grievance submitted",
      VotedForward:  "Committee voted to forward",
      VotedResolve:  "Committee voted to resolve",
      VotedDebar:    "Committee voted to debar",
      Forwarded:     "Forwarded to HoD",
      Resolved:      "Resolved",
      Debarred:      "Debarred",
      Reverted:      "Reverted for rework",
      AutoForwarded: "Auto-forwarded (threshold exceeded)",
    }[a] ?? a);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        Audit Trail
      </h2>
      <ol className="relative border-l border-gray-200 ml-3 space-y-5">
        {[...history].reverse().map((item, i) => (
          <li key={i} className="ml-4">
            <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white" />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-800">{actionLabel(item.action)}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {item.actor && `${item.actor} · `}
                  {timeAgo(item.timestamp)}
                  {" · "}
                  <span className="text-gray-400">
                    {statusLabel(item.from_status)} → {statusLabel(item.to_status)}
                  </span>
                </p>
              </div>
              {item.remarks_ipfs_cid && (
                <a
                  href={ipfsUrl(item.remarks_ipfs_cid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  Remarks <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CommitteeGrievanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc     = useQueryClient();

  const { data: grievance, isLoading, isError, refetch } = useQuery({
    queryKey: ["grievance", id],
    queryFn:  () => fetchDetail(id),
    staleTime: 30_000,
  });

  const { data: tally, refetch: refetchTally } = useQuery({
    queryKey: ["committee-tally", id],
    queryFn:  () => fetchTally(id),
    enabled:  !!grievance,
    staleTime: 15_000,
  });

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ["ipfs", grievance?.ipfs_cid],
    queryFn:  () => fetchIPFS(grievance!.ipfs_cid),
    enabled:  !!grievance?.ipfs_cid,
    staleTime: Infinity,
  });

  if (isLoading) return <Skeleton />;
  if (isError || !grievance) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-red-600 font-medium">Failed to load grievance</p>
        <button onClick={() => refetch()} className="mt-3 text-sm text-blue-600 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  const canVote = grievance.status === "AtCommittee";

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/committee/dashboard"
          className="mt-1 p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 font-mono">#{grievance.id}</span>
            <StatusBadge status={grievance.status} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-snug">{grievance.title}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {grievance.category}
            {grievance.sub_category ? ` · ${grievance.sub_category}` : ""}
            {" · "}
            {grievance.department}
            {" · "}
            {grievance.is_anonymous ? "Anonymous" : grievance.student_name}
            {" · "}
            {timeAgo(grievance.created_at)}
          </p>
        </div>
        <button
          onClick={() => { refetch(); refetchTally(); }}
          className="mt-1 p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Two-column layout on md+ */}
      <div className="grid md:grid-cols-5 gap-5">
        {/* Left: grievance content + timeline */}
        <div className="md:col-span-3 space-y-5">
          {/* IPFS content */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Grievance Content
            </h2>
            {contentLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-5/6" />
              </div>
            ) : content ? (
              <>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {content.description}
                </p>
                {content.attachments?.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Attachments
                    </p>
                    {content.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={ipfsUrl(att.cid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {att.name}
                        <ExternalLink className="h-3 w-3 text-blue-400" />
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">Content unavailable from IPFS.</p>
            )}
          </div>

          <Timeline history={grievance.action_history} />
        </div>

        {/* Right: tally + voting */}
        <div className="md:col-span-2 space-y-5">
          {tally && <TallyBar tally={tally} />}

          {canVote && !tally?.executed ? (
            <ProposePanel
              id={id}
              tally={tally}
              onVoted={() => refetchTally()}
            />
          ) : (
            !canVote && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500 text-center">
                This grievance is no longer at committee stage.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-2/3" />
      <div className="grid md:grid-cols-5 gap-5">
        <div className="md:col-span-3 h-64 bg-white border border-gray-200 rounded-xl" />
        <div className="md:col-span-2 h-48 bg-white border border-gray-200 rounded-xl" />
      </div>
    </div>
  );
}
