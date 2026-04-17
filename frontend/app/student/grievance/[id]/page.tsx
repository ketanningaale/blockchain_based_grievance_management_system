"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft,
  ThumbsUp,
  ThumbsDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Paperclip,
  Loader2,
  RefreshCw,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { cn, countdown, timeAgo, ipfsUrl, statusLabel } from "@/lib/utils";
import api from "@/lib/api";
import type { GrievanceDetail, ActionHistoryItem } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface IPFSContent {
  title:       string;
  description: string;
  attachments: { name: string; cid: string; mime_type: string }[];
  submitted_at?: string;
}

// ── Fetch helpers ──────────────────────────────────────────────────────────────

async function fetchDetail(id: string): Promise<GrievanceDetail> {
  const { data } = await api.get<GrievanceDetail>(`/api/v1/grievances/${id}`);
  return data;
}

async function fetchIPFS(cid: string): Promise<IPFSContent> {
  const res = await fetch(ipfsUrl(cid));
  if (!res.ok) throw new Error("Could not load grievance content from IPFS");
  return res.json();
}

// ── Status stepper ─────────────────────────────────────────────────────────────

const PIPELINE = [
  { key: "Submitted",        label: "Submitted" },
  { key: "AtCommittee",      label: "Committee" },
  { key: "AtHoD",            label: "HoD Review" },
  { key: "AtPrincipal",      label: "Principal" },
  { key: "AwaitingFeedback", label: "Your Feedback" },
  { key: "Closed",           label: "Closed" },
] as const;

function StatusStepper({ status }: { status: string }) {
  if (status === "Debarred") {
    return (
      <div className="flex items-center gap-3 px-5 py-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium shadow-sm">
        <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
          <AlertCircle className="h-4 w-4 text-red-600" />
        </div>
        This grievance has been debarred (marked as invalid by the committee).
      </div>
    );
  }

  const currentIdx = PIPELINE.findIndex((s) => s.key === status);

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center">
        {PIPELINE.map((step, i) => {
          const done    = i < currentIdx;
          const active  = i === currentIdx;
          const pending = i > currentIdx;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Circle */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center border-2 text-xs font-bold shrink-0 transition-all duration-200",
                    done    && "bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-500 text-white shadow-sm shadow-blue-200",
                    active  && "bg-white border-blue-500 text-blue-600 shadow-sm shadow-blue-100 ring-4 ring-blue-50",
                    pending && "bg-white border-gray-200 text-gray-300"
                  )}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-[10px] text-center leading-tight hidden sm:block font-medium",
                    done    && "text-blue-700",
                    active  && "text-blue-600",
                    pending && "text-gray-400"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector */}
              {i < PIPELINE.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-1.5 rounded-full transition-all duration-300",
                    i < currentIdx ? "bg-gradient-to-r from-blue-500 to-indigo-500" : "bg-gray-100"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Live countdown ──────────────────────────────────────────────────────────────

function CountdownBadge({ deadline }: { deadline: number }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { label, overdue } = countdown(deadline);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
        overdue
          ? "bg-red-100 text-red-700"
          : "bg-amber-50 text-amber-700 border border-amber-200"
      )}
    >
      {overdue ? <AlertCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

// ── Action history timeline ────────────────────────────────────────────────────

function ActionLabel({ action }: { action: string }) {
  const map: Record<string, string> = {
    Submitted:       "Grievance submitted",
    VotedForward:    "Committee voted to forward",
    VotedResolve:    "Committee voted to resolve",
    VotedDebar:      "Committee voted to debar",
    Forwarded:       "Forwarded",
    Resolved:        "Resolved",
    Debarred:        "Debarred",
    Reverted:        "Reverted for rework",
    FeedbackGiven:   "Feedback submitted",
    AutoForwarded:   "Auto-forwarded (threshold exceeded)",
  };
  return <>{map[action] ?? action}</>;
}

const ACTION_COLORS: Record<string, string> = {
  Submitted:     "border-blue-400 bg-blue-50",
  VotedForward:  "border-indigo-400 bg-indigo-50",
  VotedResolve:  "border-green-400 bg-green-50",
  VotedDebar:    "border-red-400 bg-red-50",
  Forwarded:     "border-amber-400 bg-amber-50",
  Resolved:      "border-green-500 bg-green-50",
  Debarred:      "border-red-500 bg-red-50",
  Reverted:      "border-orange-400 bg-orange-50",
  FeedbackGiven: "border-purple-400 bg-purple-50",
  AutoForwarded: "border-yellow-400 bg-yellow-50",
};

function Timeline({ history }: { history: ActionHistoryItem[] }) {
  if (history.length === 0) return null;

  return (
    <div className="card-elevated p-5 space-y-4">
      <h2 className="text-sm font-bold text-gray-800">
        On-Chain Audit Trail
      </h2>

      <ol className="space-y-3">
        {[...history].reverse().map((item, i) => (
          <li key={i} className={cn(
            "flex gap-4 p-4 rounded-xl border-l-4 transition-all duration-200 hover:shadow-sm",
            ACTION_COLORS[item.action] ?? "border-gray-300 bg-gray-50"
          )}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">
                <ActionLabel action={item.action} />
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.actor && <span className="font-medium text-gray-700">by {item.actor} · </span>}
                {timeAgo(item.timestamp)}
                {" · "}
                <span className="text-gray-400">{statusLabel(item.from_status)} → {statusLabel(item.to_status)}</span>
              </p>
            </div>

            {item.remarks_ipfs_cid && (
              <a
                href={ipfsUrl(item.remarks_ipfs_cid)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0"
              >
                Remarks <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Vote buttons ───────────────────────────────────────────────────────────────

function VotePanel({
  id,
  upvotes,
  downvotes,
}: {
  id: number;
  upvotes: number;
  downvotes: number;
}) {
  const qc = useQueryClient();
  const [voted, setVoted] = useState<"up" | "down" | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: (direction: "up" | "down") =>
      api.post(`/api/v1/grievances/${id}/vote`, { is_upvote: direction === "up" }),
    onSuccess: (_, dir) => {
      setVoted(dir);
      toast.success("Vote recorded on-chain.");
      qc.invalidateQueries({ queryKey: ["grievance", String(id)] });
    },
    onError: (err: Error) => {
      const msg = err.message.includes("already")
        ? "You have already voted on this grievance."
        : err.message;
      toast.error(msg);
    },
  });

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs font-medium text-gray-500">Community vote:</span>
      <button
        onClick={() => mutate("up")}
        disabled={isPending || voted !== null}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all duration-200",
          voted === "up"
            ? "bg-green-50 border-green-400 text-green-700 shadow-sm"
            : "bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50 disabled:opacity-50"
        )}
      >
        <ThumbsUp className="h-4 w-4" />
        {upvotes}
      </button>
      <button
        onClick={() => mutate("down")}
        disabled={isPending || voted !== null}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all duration-200",
          voted === "down"
            ? "bg-red-50 border-red-400 text-red-700 shadow-sm"
            : "bg-white border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
        )}
      >
        <ThumbsDown className="h-4 w-4" />
        {downvotes}
      </button>
    </div>
  );
}

// ── Feedback form ──────────────────────────────────────────────────────────────

function FeedbackPanel({ id }: { id: number }) {
  const qc = useQueryClient();
  const [satisfied, setSatisfied] = useState<boolean | null>(null);
  const [remarks,   setRemarks]   = useState("");
  const [done,      setDone]      = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/grievances/${id}/feedback`, {
        is_satisfied: satisfied,
        remarks: remarks || undefined,
      }),
    onSuccess: () => {
      setDone(true);
      toast.success("Feedback submitted. Thank you!");
      qc.invalidateQueries({ queryKey: ["grievance", String(id)] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (done) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Feedback recorded. The grievance has been updated.
      </div>
    );
  }

  return (
    <div className="card-elevated border-purple-200 p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-purple-800">Your Feedback Required</h2>
          <p className="text-xs text-purple-600">The committee has resolved this grievance</p>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Are you satisfied with the outcome of your grievance?
      </p>

      {/* Satisfied / Unsatisfied — large clickable cards */}
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((val) => (
          <button
            key={String(val)}
            type="button"
            onClick={() => setSatisfied(val)}
            className={cn(
              "flex flex-col items-center justify-center py-5 px-4 rounded-2xl border-2 text-sm font-semibold transition-all duration-200",
              satisfied === val
                ? val
                  ? "bg-green-600 border-green-600 text-white shadow-md shadow-green-200"
                  : "bg-red-600 border-red-600 text-white shadow-md shadow-red-200"
                : val
                  ? "bg-white border-gray-200 text-gray-700 hover:border-green-400 hover:bg-green-50 hover:text-green-700"
                  : "bg-white border-gray-200 text-gray-700 hover:border-red-400 hover:bg-red-50 hover:text-red-700"
            )}
          >
            <span className="text-2xl mb-1.5">{val ? "😊" : "😞"}</span>
            {val ? "Satisfied" : "Not Satisfied"}
          </button>
        ))}
      </div>

      {/* Optional remarks */}
      <textarea
        rows={3}
        placeholder="Additional remarks (optional)…"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        className="input-base resize-none focus:ring-purple-500/20 focus:border-purple-400"
      />

      <button
        onClick={() => satisfied !== null && mutate()}
        disabled={satisfied === null || isPending}
        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-purple-700
                   text-white rounded-xl text-sm font-semibold hover:from-purple-700 hover:to-purple-800
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit Feedback
      </button>

      {satisfied === false && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Marking as unsatisfied will re-escalate the grievance to the Committee for further review.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function GrievanceDetailPage() {
  const params = useParams<{ id: string }>();
  const id     = params.id;

  const {
    data: grievance,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["grievance", id],
    queryFn:  () => fetchDetail(id),
    staleTime: 30_000,
  });

  const {
    data: content,
    isLoading: contentLoading,
  } = useQuery({
    queryKey: ["ipfs", grievance?.ipfs_cid],
    queryFn:  () => fetchIPFS(grievance!.ipfs_cid),
    enabled:  !!grievance?.ipfs_cid,
    staleTime: Infinity,  // IPFS content is immutable
  });

  if (isLoading) return <DetailSkeleton />;

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

  const isActive  = !["Closed", "Debarred"].includes(grievance.status);
  const isOwnView = true; // Student is always viewing their own or another's

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Back + header */}
      <div className="flex items-start gap-3">
        <Link
          href="/student/dashboard"
          className="mt-1 p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-500 transition-all duration-200 border border-transparent hover:border-gray-200 shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="badge bg-gray-100 text-gray-500 font-mono">#{grievance.id}</span>
            <StatusBadge status={grievance.status} />
            {isActive && <CountdownBadge deadline={grievance.threshold_deadline} />}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">{grievance.title}</h1>
          <p className="text-sm text-gray-500 mt-1.5 flex flex-wrap gap-1 items-center">
            <span className="badge bg-blue-50 text-blue-700">{grievance.category}</span>
            {grievance.sub_category && <span className="badge bg-indigo-50 text-indigo-700">{grievance.sub_category}</span>}
            <span className="badge bg-gray-100 text-gray-600">{grievance.department}</span>
            <span className="text-gray-400">·</span>
            <span>{grievance.is_anonymous ? "Anonymous" : grievance.student_name}</span>
            <span className="text-gray-400">·</span>
            <span>{timeAgo(grievance.created_at)}</span>
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="mt-1 p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-400 hover:text-gray-600 transition-all duration-200 border border-transparent hover:border-gray-200"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Status stepper */}
      <StatusStepper status={grievance.status} />

      {/* IPFS content */}
      <div className="card-elevated p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-800">
          Grievance Content
        </h2>

        {contentLoading ? (
          <div className="space-y-2.5 animate-pulse">
            <div className="h-4 bg-gray-100 rounded-lg w-3/4" />
            <div className="h-4 bg-gray-100 rounded-lg w-full" />
            <div className="h-4 bg-gray-100 rounded-lg w-5/6" />
            <div className="h-4 bg-gray-100 rounded-lg w-2/3" />
          </div>
        ) : content ? (
          <>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {content.description}
            </p>

            {content.attachments?.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Attachments
                </p>
                <ul className="space-y-1.5">
                  {content.attachments.map((att, i) => (
                    <li key={i}>
                      <a
                        href={ipfsUrl(att.cid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline transition-colors"
                      >
                        <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
                          <Paperclip className="h-3 w-3 text-blue-500" />
                        </div>
                        {att.name}
                        <ExternalLink className="h-3 w-3 text-blue-400" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">Content unavailable from IPFS.</p>
        )}

        {/* On-chain tx link */}
        <div className="pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <VotePanel
            id={grievance.id}
            upvotes={grievance.upvotes}
            downvotes={grievance.downvotes}
          />
          {grievance.tx_hash && (
            <span className="badge bg-gray-100 text-gray-500 font-mono text-[10px]" title={grievance.tx_hash}>
              tx: {grievance.tx_hash.slice(0, 18)}…
            </span>
          )}
        </div>
      </div>

      {/* Feedback panel (only when awaiting feedback) */}
      {grievance.status === "AwaitingFeedback" && (
        <FeedbackPanel id={grievance.id} />
      )}

      {/* Audit trail */}
      <Timeline history={grievance.action_history} />
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-5 max-w-3xl mx-auto animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-2/3" />
      <div className="h-14 bg-white border border-gray-200 rounded-xl" />
      <div className="h-48 bg-white border border-gray-200 rounded-xl" />
      <div className="h-32 bg-white border border-gray-200 rounded-xl" />
    </div>
  );
}
