import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";
import { answerQuestion } from "@/lib/openai";
import type { AskResponse } from "@/lib/types";

type RetrievedChunk = {
  document_id: string;
  content: string;
  similarity: number;
};

type FallbackDocument = {
  id: string;
  title: string;
  summary: string;
  issuing_organization: string | null;
  raw_text: string;
};

const COMMON_SEARCH_WORDS = new Set([
  "about",
  "across",
  "again",
  "all",
  "and",
  "are",
  "can",
  "count",
  "documents",
  "from",
  "have",
  "how",
  "many",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "uploaded",
  "what",
  "which",
  "with",
  "your",
]);

function extractSearchTerms(question: string): string[] {
  const words = question.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
  return [...new Set(words)]
    .filter((word) => !COMMON_SEARCH_WORDS.has(word))
    .slice(0, 6);
}

function buildKeywordFilter(terms: string[]): string {
  return terms
    .flatMap((term) => [
      `title.ilike.%${term}%`,
      `summary.ilike.%${term}%`,
      `issuing_organization.ilike.%${term}%`,
      `file_name.ilike.%${term}%`,
      `raw_text.ilike.%${term}%`,
    ])
    .join(",");
}

async function searchDocumentsWithoutVectors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  question: string,
  documentId?: string
): Promise<RetrievedChunk[]> {
  const terms = extractSearchTerms(question);
  let query = supabase
    .from("analyzed_documents")
    .select("id, title, summary, issuing_organization, raw_text")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(documentId ? 1 : 12);

  if (documentId) {
    query = query.eq("id", documentId);
  } else if (terms.length > 0) {
    query = query.or(buildKeywordFilter(terms));
  }

  const { data, error } = await query;

  if (error) {
    console.error("Fallback document search error:", error);
    return [];
  }

  return ((data || []) as FallbackDocument[]).map((doc) => ({
    document_id: doc.id,
    similarity: 0.15,
    content: [
      doc.title,
      doc.issuing_organization
        ? `Issuing Organization: ${doc.issuing_organization}`
        : null,
      doc.summary,
      doc.raw_text.slice(0, 1500),
    ]
      .filter(Boolean)
      .join("\n\n"),
  }));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();

    if (authError || !claimsData?.claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = claimsData.claims.sub as string;

    const body = await request.json();
    const {
      question,
      document_id,
      chat_history = [],
    }: {
      question: string;
      document_id?: string;
      chat_history?: { role: "user" | "assistant"; content: string }[];
    } = body;

    if (!question || question.trim().length === 0) {
      return NextResponse.json(
        { error: "Please provide a question" },
        { status: 400 }
      );
    }

    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question);
    let chunks: RetrievedChunk[] = [];

    // Search for relevant chunks using vector similarity
    const { data: semanticChunks, error: searchError } = await supabase.rpc(
      "match_document_chunks",
      {
        query_embedding: JSON.stringify(questionEmbedding),
        match_user_id: userId,
        match_document_id: document_id || null,
        match_threshold: 0.3,
        match_count: 8,
      }
    );

    if (searchError) {
      console.error("Vector search error, falling back to keyword search:", searchError);
      chunks = await searchDocumentsWithoutVectors(
        supabase,
        userId,
        question,
        document_id
      );
    } else if (semanticChunks && semanticChunks.length > 0) {
      chunks = semanticChunks as RetrievedChunk[];
    } else {
      chunks = await searchDocumentsWithoutVectors(
        supabase,
        userId,
        question,
        document_id
      );
    }

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        answer:
          "I couldn't find any relevant information in your documents to answer this question. Try uploading more documents or rephrasing your question.",
        sources: [],
      } satisfies AskResponse);
    }

    // Fetch document titles for the matched chunks
    const documentIds = [...new Set(chunks.map((c: { document_id: string }) => c.document_id))];
    const { data: docs } = await supabase
      .from("analyzed_documents")
      .select("id, title")
      .in("id", documentIds);

    const titleMap = new Map(
      (docs || []).map((d: { id: string; title: string }) => [d.id, d.title])
    );

    // Build context for the LLM
    const contextChunks = chunks.map(
      (c: { content: string; document_id: string }) => ({
        content: c.content,
        document_title: titleMap.get(c.document_id) || "Unknown Document",
      })
    );

    // Generate answer
    const answer = await answerQuestion(question, contextChunks, chat_history);

    const sources = chunks.map(
      (c: {
        document_id: string;
        content: string;
        similarity: number;
      }) => ({
        document_id: c.document_id,
        document_title: titleMap.get(c.document_id) || "Unknown Document",
        chunk_content: c.content.slice(0, 300),
        similarity: c.similarity,
      })
    );

    return NextResponse.json({ answer, sources } satisfies AskResponse);
  } catch (err) {
    console.error("Ask error:", err);
    return NextResponse.json(
      { error: "Failed to process your question. Please try again." },
      { status: 500 }
    );
  }
}
