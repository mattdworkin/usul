// ── Extraction result from GPT-4o ───────────────────────────

export interface PersonExtraction {
  name: string;
  role: string | null;
  organization: string | null;
  contact_info: string | null;
  context: string; // what this person does with this contract
}

export interface OrganizationExtraction {
  name: string;
  org_type: string | null; // "Government Agency", "Contractor", etc.
  role_in_contract: string; // their role
  context: string; // deeper explanation
}

export interface DocumentExtractionResult {
  document_type: "rfq" | "rfi" | "pws" | "special_notice" | "other";
  title: string;
  summary: string;
  issuing_organization: string | null;
  buyer_or_poc: string | null;
  people: PersonExtraction[];
  organizations: OrganizationExtraction[];
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

// ── Database row types ──────────────────────────────────────

export interface AnalyzedDocument {
  id: string;
  user_id: string;
  file_name: string | null;
  raw_text: string;
  document_type: string;
  title: string;
  summary: string;
  issuing_organization: string | null;
  buyer_or_poc: string | null;
  solicitation_or_tracking_number: string | null;
  issue_date: string | null;
  response_due_date: string | null;
  period_of_performance: string | null;
  location: string | null;
  contract_type: string | null;
  important_people: PersonExtraction[];
  important_organizations: OrganizationExtraction[];
  event_dates: string[];
  key_requirements: string[];
  submission_requirements: string[];
  created_at: string;
}

export interface DocumentPerson {
  id: string;
  document_id: string;
  name: string;
  role: string | null;
  organization: string | null;
  contact_info: string | null;
  context: string;
}

export interface DocumentOrganization {
  id: string;
  document_id: string;
  name: string;
  org_type: string | null;
  role_in_contract: string;
  context: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
}

// ── API response types ──────────────────────────────────────

export type AnalyzeResponse =
  | { success: true; document: AnalyzedDocument }
  | { success: false; error: string };

export interface DocumentsResponse {
  documents: AnalyzedDocument[];
}

export interface AskResponse {
  answer: string;
  sources: {
    document_id: string;
    document_title: string;
    chunk_content: string;
    similarity: number;
  }[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: AskResponse["sources"];
}
