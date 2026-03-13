import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { createClient } from "@/lib/supabase/server";
import { extractDocumentInsights } from "@/lib/openai";
import { generateEmbeddings, chunkText } from "@/lib/embeddings";
import type { AnalyzeResponse } from "@/lib/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_SIZE = 500 * 1024; // 500KB of text

function errorResponse(message: string, status: number): NextResponse<AnalyzeResponse> {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();

    if (authError || !claimsData?.claims) {
      return errorResponse("Unauthorized", 401);
    }

    const userId = claimsData.claims.sub as string;

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const pastedText = formData.get("text") as string | null;

    let rawText = "";
    let fileName: string | null = null;

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return errorResponse("File exceeds 10MB limit", 400);
      }

      fileName = file.name;
      const fileType = file.type;
      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      if (fileType === "application/pdf" || fileExtension === "pdf") {
        const arrayBuffer = await file.arrayBuffer();
        const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
        const textResult = await parser.getText();
        rawText = textResult.text;
        await parser.destroy();
      } else if (fileType === "text/plain" || fileExtension === "txt") {
        rawText = await file.text();
      } else {
        return errorResponse("Only PDF and text files are supported", 400);
      }
    } else if (pastedText && pastedText.trim().length > 0) {
      rawText = pastedText.trim();
    } else {
      return errorResponse("Please provide text or upload a file", 400);
    }

    rawText = rawText.trim();
    if (rawText.length === 0) {
      return errorResponse(
        "Could not extract text from this file. The file may be image-based or empty.",
        400
      );
    }

    if (rawText.length > MAX_TEXT_SIZE) {
      rawText = rawText.slice(0, MAX_TEXT_SIZE);
    }

    // ── Step 1: Extract insights via GPT-4o ───────────────────
    const extraction = await extractDocumentInsights(rawText);

    // ── Step 2: Generate embeddings in parallel ───────────────
    // Chunk the raw text for RAG retrieval
    const chunks = chunkText(rawText);

    // Generate embeddings: one for the summary (doc-level) + one per chunk
    const textsToEmbed = [
      `${extraction.title}. ${extraction.summary}`,
      ...chunks,
    ];
    const embeddings = await generateEmbeddings(textsToEmbed);
    const summaryEmbedding = embeddings[0];
    const chunkEmbeddings = embeddings.slice(1);

    // ── Step 3: Save document to Supabase ─────────────────────
    const { data: inserted, error: dbError } = await supabase
      .from("analyzed_documents")
      .insert({
        user_id: userId,
        file_name: fileName,
        raw_text: rawText,
        document_type: extraction.document_type,
        title: extraction.title,
        summary: extraction.summary,
        issuing_organization: extraction.issuing_organization,
        buyer_or_poc: extraction.buyer_or_poc,
        solicitation_or_tracking_number: extraction.solicitation_or_tracking_number,
        issue_date: extraction.issue_date,
        response_due_date: extraction.response_due_date,
        period_of_performance: extraction.period_of_performance,
        location: extraction.location,
        contract_type: extraction.contract_type,
        important_people: extraction.people,
        important_organizations: extraction.organizations,
        event_dates: extraction.event_dates,
        key_requirements: extraction.key_requirements,
        submission_requirements: extraction.submission_requirements,
        embedding: JSON.stringify(summaryEmbedding),
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      return errorResponse("Failed to save analysis results", 500);
    }

    const documentId = inserted.id;

    // ── Step 4: Store chunks, people, orgs in parallel ────────
    const parallelInserts = [];

    // Insert chunks
    if (chunks.length > 0) {
      const chunkRows = chunks.map((content, i) => ({
        document_id: documentId,
        user_id: userId,
        chunk_index: i,
        content,
        embedding: JSON.stringify(chunkEmbeddings[i]),
      }));
      parallelInserts.push(
        supabase.from("document_chunks").insert(chunkRows)
      );
    }

    // Insert people
    if (extraction.people.length > 0) {
      const peopleRows = extraction.people.map((p) => ({
        document_id: documentId,
        user_id: userId,
        name: p.name,
        role: p.role,
        organization: p.organization,
        contact_info: p.contact_info,
        context: p.context,
      }));
      parallelInserts.push(
        supabase.from("document_people").insert(peopleRows)
      );
    }

    // Insert organizations
    if (extraction.organizations.length > 0) {
      const orgRows = extraction.organizations.map((o) => ({
        document_id: documentId,
        user_id: userId,
        name: o.name,
        org_type: o.org_type,
        role_in_contract: o.role_in_contract,
        context: o.context,
      }));
      parallelInserts.push(
        supabase.from("document_organizations").insert(orgRows)
      );
    }

    // Fire all inserts in parallel — don't block response on these
    const results = await Promise.allSettled(parallelInserts);
    for (const r of results) {
      if (r.status === "rejected") {
        console.error("Parallel insert failed:", r.reason);
      } else if (r.value.error) {
        console.error("Parallel insert error:", r.value.error);
      }
    }

    return NextResponse.json({ success: true, document: inserted });
  } catch (err) {
    console.error("Analysis error:", err);

    if (err instanceof Error && err.message === "OPENAI_API_KEY is not configured") {
      return errorResponse("Server configuration error", 500);
    }

    return errorResponse(
      "Analysis failed. The AI service may be temporarily unavailable. Please try again.",
      502
    );
  }
}
