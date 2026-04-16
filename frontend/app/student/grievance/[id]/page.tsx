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
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">
        <AlertCircle className="h-4 w-4 shrink-0" />
        This grievance has been debarred (marked as invalid by the committee).
      </div>
    );
  }

  const currentIdx = PIPELINE.findIndex((s) => s.key === status);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center">
        {PIPELINE.map((step, i) => {
          const done    = i < currentIdx;
          const active  = i === currentIdx;
          const pending = i > currentIdx;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Circle */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center border-2 text-xs font-bold shrink-0",
                    done    && "bg-blue-600 border-blue-600 text-white",
                    active  && "bg-white border-blue-600 text-blue-600",
                    pending && "bg-white border-gray-300 text-gray-400"
                  )}
                >
                  {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-[10px] text-center leading-tight hidden sm:block",
                    done || active ? "text-gray-700 font-medium" : "text-gray-400"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector */}
              {i < PIPELINE.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-1",
                    i < currentIdx ? "bg-blue-600" : "bg-gray-200"
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

function Timeline({ history }: { history: ActionHistoryItem[] }) {
  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
        On-Chain Audit Trail
      </h2>

      <ol className="relative border-l border-gray-200 ml-3 space-y-5">
        {[...history].reverse().map((item, i) => (
          <li key={i} className="ml-4">
            {/* Dot */}
            <span className="absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-blue-600 ring-4 ring-white" />

            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  <ActionLabel action={item.action} />
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {item.actor && `by ${item.actor} · `}
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
      api.post(`/api/v1/grievances/${id}/vote`, { direction }),
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
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500">Community vote:</span>
      <button
        onClick={() => mutate("up")}
        disabled={isPending || voted !== null}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
          voted === "up"
            ? "bg-green-50 border-green-400 text-green-700"
            : "bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700 disabled:opacity-50"
        )}
      >
        <ThumbsUp className="h-4 w-4" />
        {upvotes}
      </button>
      <button
        onClick={() => mutate("down")}
        disabled={isPending || voted !== null}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
          voted === "down"
            ? "bg-red-50 border-red-400 text-red-700"
            : "bg-white border-gray-200 text-gray-600 hover:border-red-400 hover:text-red-700 disabled:opacity-50"
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
        satisfied,
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
    <div className="bg-white rounded-xl border border-purple-200 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wide">
        Your Feedback Required
      </h2>
      <p className="text-sm text-gray-600">
        The committee has resolved this grievance. Are you satisfied with the outcome?
      </p>

      {/* Satisfied / Unsatisfied */}
      <div className="flex gap-3">
        {[true, false].map((val) => (
          <button
            key={String(val)}
            type="button"
            onClick={() => setSatisfied(val)}
            className={cn(
              "flex-1 py-2 rounded-lg border text-sm font-medium transition-colors",
              satisfied === val
                ? val
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-red-600 border-red-600 text-white"
                : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
            )}
          >
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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none
                   focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
      />

      <button
        onClick={() => satisfied !== null && mutate()}
        disabled={satisfied === null || isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white
                   rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Submit Feedback
      </button>

      {satisfied === false && (
        <p className="text-xs text-amber-600">
          Marking as unsatisfied will re-escalate the grievance to the Committee for further review.
        </p>
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
          className="mt-1 p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 font-mono">#{grievance.id}</span>
            <StatusBadge status={grievance.status} />
            {isActive && <CountdownBadge deadline={grievance.threshold_deadline} />}
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
          onClick={() => refetch()}
          className="mt-1 p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Status stepper */}
      <StatusStepper status={grievance.status} />

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
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Attachments
                </p>
                <ul className="space-y-1.5">
                  {content.attachments.map((att, i) => (
                    <li key={i}>
                      <a
                        href={ipfsUrl(att.cid)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
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
        <div className="pt-2 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <VotePanel
            id={grievance.id}
            upvotes={grievance.upvotes}
            downvotes={grievance.downvotes}
          />
          {grievance.tx_hash && (
            <span className="text-xs font-mono text-gray-400 truncate max-w-[200px]" title={grievance.tx_hash}>
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
