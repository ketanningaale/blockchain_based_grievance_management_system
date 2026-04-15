// ── User ──────────────────────────────────────────────────────────────────────

export type Role = "student" | "committee" | "hod" | "principal" | "admin";

export interface UserProfile {
  uid:           string;
  display_name:  string;
  email:         string;
  role:          Role;
  department:    string;
  institute_id:  string;
  wallet_address?: string;
}

// ── Grievance ─────────────────────────────────────────────────────────────────

export type GrievanceStatus =
  | "Submitted"
  | "AtCommittee"
  | "AtHoD"
  | "AtPrincipal"
  | "AwaitingFeedback"
  | "Closed"
  | "Debarred";

export interface GrievanceListItem {
  id:                 number;
  title:              string;
  category:           string;
  department:         string;
  status:             GrievanceStatus;
  is_anonymous:       boolean;
  upvotes:            number;
  downvotes:          number;
  created_at:         number;   // Unix seconds
  threshold_deadline: number;   // Unix seconds
  student_name:       string;
}

export interface ActionHistoryItem {
  grievance_id:     number;
  actor:            string;
  action:           string;
  remarks_ipfs_cid: string;
  timestamp:        number;   // Unix seconds
  from_status:      string;
  to_status:        string;
}

export interface GrievanceDetail extends GrievanceListItem {
  student_identifier: string;
  sub_category:       string;
  ipfs_cid:           string;
  updated_at:         number;
  action_history:     ActionHistoryItem[];
  tx_hash:            string;
}

// ── Committee ─────────────────────────────────────────────────────────────────

export interface VoteTally {
  proposedAction: string;
  yesCount:       number;
  noCount:        number;
  executed:       boolean;
  majorityNeeded: number;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  total:             number;
  pending:           number;
  resolved:          number;
  awaiting_feedback: number;
  debarred:          number;
  by_status:         Record<string, number>;
}

export interface DeptBreakdown {
  department: string;
  total:      number;
  resolved:   number;
}
