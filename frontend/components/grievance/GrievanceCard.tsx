import Link from "next/link";
import { ThumbsUp, ThumbsDown, Clock, AlertCircle } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { countdown, timeAgo } from "@/lib/utils";
import type { GrievanceListItem } from "@/types";

interface GrievanceCardProps {
  grievance:  GrievanceListItem;
  /** Base path to prefix the grievance ID link (e.g. "/student/grievance") */
  detailBase: string;
  /** Whether to show the student name (hidden for anonymous or when already in student view) */
  showStudent?: boolean;
}

export default function GrievanceCard({
  grievance,
  detailBase,
  showStudent = false,
}: GrievanceCardProps) {
  const { label: countdownLabel, overdue } = countdown(grievance.threshold_deadline);
  const isActive = !["Closed", "Debarred"].includes(grievance.status);

  return (
    <Link
      href={`${detailBase}/${grievance.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300
                 hover:shadow-md transition-all group"
    >
      {/* Top row: title + badge */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 flex-1">
          {grievance.title}
        </h3>
        <StatusBadge status={grievance.status} className="shrink-0" />
      </div>

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="font-medium text-gray-700">{grievance.category}</span>
        {grievance.department && <span>{grievance.department}</span>}
        {showStudent && !grievance.is_anonymous && (
          <span>{grievance.student_name}</span>
        )}
        {grievance.is_anonymous && (
          <span className="italic">Anonymous</span>
        )}
        <span>{timeAgo(grievance.created_at)}</span>
      </div>

      {/* Bottom row: votes + countdown */}
      <div className="mt-3 flex items-center justify-between">
        {/* Votes */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5" />
            {grievance.upvotes}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsDown className="h-3.5 w-3.5" />
            {grievance.downvotes}
          </span>
        </div>

        {/* Countdown — only meaningful while grievance is active */}
        {isActive && (
          <span
            className={`flex items-center gap-1 text-xs font-medium ${
              overdue ? "text-red-600" : "text-gray-500"
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
    </Link>
  );
}
