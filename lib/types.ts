export interface DocumentExtractionResult {
  document_type: "rfq" | "rfi" | "pws" | "special_notice" | "other";
  title: string;
  summary: string;
  issuing_organization: string | null;
  buyer_or_poc: string | null;
  important_people: string[];
  important_organizations: string[];
  solicitation_or_tracking_number: string | null;
  issue_date: string | null;
  response_due_date: string | null;
  event_dates: string[];
  period_of_performance: string | null;
  location: string | null;
  key_requirements: string[];
  submission_requirements: string[];
  contract_type: string | null;
}

export interface AnalyzedDocument extends DocumentExtractionResult {
  id: string;
  user_id: string;
  file_name: string | null;
  raw_text: string;
  created_at: string;
}

export type AnalyzeResponse =
  | { success: true; document: AnalyzedDocument }
  | { success: false; error: string };

export interface DocumentsResponse {
  documents: AnalyzedDocument[];
}
