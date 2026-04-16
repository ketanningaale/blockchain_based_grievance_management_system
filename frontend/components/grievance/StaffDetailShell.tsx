"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ExternalLink, Paperclip, RefreshCw } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { ipfsUrl, statusLabel, timeAgo } from "@/lib/utils";
import api from "@/lib/api";
import type { GrievanceDetail, ActionHistoryItem } from "@/types";

interface IPFSContent {
  description: string;
  attachments: { name: string; cid: string; mime_type: string }[];
}

async function fetchIPFS(cid: string): Promise<IPFSContent> {
  const res = await fetch(ipfsUrl(cid));
  if (!res.ok) throw new Error("Could not load IPFS content");
  return res.json();
}

function Timeline({ history }: { history: ActionHistoryItem[] }) {
  if (!history.length) return null;
  const label = (a: string) =>
    ({
      Submitted:     "Grievance submitted",
      VotedForward:  "Committee voted to forward",
      VotedResolve:  "Committee voted to resolve",
      VotedDebar:    "Committee voted to debar",
      Forwarded:     "Forwarded",
      Resolved:      "Resolved",
      Debarred:      "Debarred",
      Reverted:      "Reverted for rework",
      FeedbackGiven: "Feedback submitted",
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
                <p className="text-sm font-medium text-gray-800">{label(item.action)}</p>
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

interface StaffDetailShellProps {
  id:          string;
  backHref:    string;
  queryKey:    string;
  /** Slot rendered in the right column (action panel or tally) */
  actionSlot?: React.ReactNode;
}

/**
 * Shared layout for HoD and Principal grievance detail pages.
 * Left column: IPFS content + audit trail.
 * Right column: actionSlot (passed by the parent page).
 */
export default function StaffDetailShell({
  id,
  backHref,
  queryKey,
  actionSlot,
}: StaffDetailShellProps) {
  const { data: grievance, isLoading, isError, refetch } = useQuery({
    queryKey: [queryKey, id],
    queryFn:  () =>
      api.get<GrievanceDetail>(`/api/v1/grievances/${id}`).then((r) => r.data),
    staleTime: 30_000,
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

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href={backHref}
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
          onClick={() => refetch()}
          className="mt-1 p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Two-column */}
      <div className="grid md:grid-cols-5 gap-5">
        {/* Left: content + timeline */}
        <div className="md:col-span-3 space-y-5">
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

        {/* Right: action slot */}
        <div className="md:col-span-2">
          {actionSlot}
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
