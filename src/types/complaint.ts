export type ComplaintLanguage = "en" | "as";

export type ComplaintStatus =
  | "submitted"
  | "under_review"
  | "in_progress"
  | "resolved"
  | "rejected";

export interface ComplaintCoordinates {
  lat: number;
  lng: number;
}

export interface Complaint {
  id: string;
  uid: string;
  userEmail: string | null;
  userName: string;
  title: string;
  description: string;
  language: ComplaintLanguage;
  location: string;

  // New: geographical location for CivicMap
  coordinates?: ComplaintCoordinates | null;

  category: string;
  priority: string;
  department: string;
  status: ComplaintStatus;

  // New: total community votes
  voteCount?: number;

  image: null | {
    publicId: string;
    secureUrl: string;
    format: string;
    bytes: number;
  };

  aiAnalysis: unknown;
  createdAt: string | null;
  updatedAt: string | null;
}