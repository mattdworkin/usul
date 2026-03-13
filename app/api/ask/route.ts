import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";
import { answerQuestion } from "@/lib/openai";
import type { AskResponse } from "@/lib/types";

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

    // Search for relevant chunks using vector similarity
    const { data: chunks, error: searchError } = await supabase.rpc(
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
      console.error("Vector search error:", searchError);
      return NextResponse.json(
        { error: "Failed to search documents" },
        { status: 500 }
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
