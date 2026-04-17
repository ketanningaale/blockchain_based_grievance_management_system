import Link from "next/link";
import { ThumbsUp, ThumbsDown, Clock, AlertCircle, ChevronRight } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { countdown, timeAgo } from "@/lib/utils";
import type { GrievanceListItem } from "@/types";

interface GrievanceCardProps {
  grievance:  GrievanceListItem;
  detailBase: string;
  showStudent?: boolean;
}

const STATUS_ACCENT: Record<string, string> = {
  Submitted:        "bg-slate-400",
  AtCommittee:      "bg-blue-500",
  AtHoD:            "bg-amber-500",
  AtPrincipal:      "bg-orange-500",
  AwaitingFeedback: "bg-purple-500",
  Closed:           "bg-emerald-500",
  Debarred:         "bg-red-500",
};

export default function GrievanceCard({
  grievance,
  detailBase,
  showStudent = false,
}: GrievanceCardProps) {
  const { label: countdownLabel, overdue } = countdown(grievance.threshold_deadline);
  const isActive = !["Closed", "Debarred"].includes(grievance.status);
  const accent = STATUS_ACCENT[grievance.status] ?? "bg-slate-300";

  return (
    <Link
      href={`${detailBase}/${grievance.id}`}
      className="group flex bg-white rounded-2xl border border-slate-100 shadow-sm
                 hover:shadow-md hover:border-slate-200 transition-all duration-200 overflow-hidden"
    >
      {/* Colour accent bar */}
      <div className={`w-1 flex-shrink-0 ${accent} rounded-l-2xl`} />

      {/* Content */}
      <div className="flex-1 px-5 py-4 min-w-0">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 line-clamp-2 flex-1 transition-colors">
            {grievance.title}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={grievance.status} />
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
          </div>
        </div>

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{grievance.category}</span>
          {grievance.department && (
            <>
              <span className="text-slate-300">·</span>
              <span>{grievance.department}</span>
            </>
          )}
          {showStudent && !grievance.is_anonymous && (
            <>
              <span className="text-slate-300">·</span>
              <span>{grievance.student_name}</span>
            </>
          )}
          {grievance.is_anonymous && (
            <>
              <span className="text-slate-300">·</span>
              <span className="italic text-slate-400">Anonymous</span>
            </>
          )}
          <span className="text-slate-300">·</span>
          <span>{timeAgo(grievance.created_at)}</span>
        </div>

        {/* Bottom row */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" />
              {grievance.upvotes}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsDown className="h-3.5 w-3.5" />
              {grievance.downvotes}
            </span>
          </div>

          {isActive && (
            <span
              className={`flex items-center gap-1 text-xs font-medium ${
                overdue ? "text-red-500" : "text-slate-400"
              }`}
            >
              {overdue ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
              {countdownLabel}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
