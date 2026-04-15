import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, fromUnixTime } from "date-fns";

/** Merge Tailwind classes safely (shadcn/ui convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert a Unix timestamp (seconds) to a relative time string. */
export function timeAgo(unixSeconds: number): string {
  return formatDistanceToNow(fromUnixTime(unixSeconds), { addSuffix: true });
}

/**
 * Countdown from a Unix deadline to now.
 * Returns a human-readable string or "Overdue" if past.
 */
export function countdown(deadlineUnix: number): { label: string; overdue: boolean } {
  const now      = Math.floor(Date.now() / 1000);
  const diff     = deadlineUnix - now;

  if (diff <= 0) return { label: "Overdue", overdue: true };

  const days     = Math.floor(diff / 86400);
  const hours    = Math.floor((diff % 86400) / 3600);
  const minutes  = Math.floor((diff % 3600) / 60);

  if (days > 0)   return { label: `${days}d ${hours}h remaining`, overdue: false };
  if (hours > 0)  return { label: `${hours}h ${minutes}m remaining`, overdue: false };
  return           { label: `${minutes}m remaining`, overdue: false };
}

/** Map a grievance status string to a Tailwind badge colour. */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    AtCommittee:       "bg-blue-100 text-blue-800",
    AtHoD:             "bg-yellow-100 text-yellow-800",
    AtPrincipal:       "bg-orange-100 text-orange-800",
    AwaitingFeedback:  "bg-purple-100 text-purple-800",
    Closed:            "bg-green-100 text-green-800",
    Debarred:          "bg-red-100 text-red-800",
    Submitted:         "bg-gray-100 text-gray-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-800";
}

/** Map a grievance status to a friendly label. */
export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    AtCommittee:       "At Committee",
    AtHoD:             "At Head of Department",
    AtPrincipal:       "At Principal",
    AwaitingFeedback:  "Awaiting Your Feedback",
    Closed:            "Closed",
    Debarred:          "Debarred",
    Submitted:         "Submitted",
  };
  return map[status] ?? status;
}

/** IPFS CID → public gateway URL */
export function ipfsUrl(cid: string): string {
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
  return `${gateway}/ipfs/${cid}`;
}
