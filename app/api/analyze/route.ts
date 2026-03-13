import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { createClient } from "@/lib/supabase/server";
import { extractDocumentInsights } from "@/lib/openai";
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
      // File upload path
      if (file.size > MAX_FILE_SIZE) {
        return errorResponse("File exceeds 10MB limit", 400);
      }

      fileName = file.name;
      const fileType = file.type;
      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      if (fileType === "application/pdf" || fileExtension === "pdf") {
        // PDF parsing with pdf-parse v2
        const arrayBuffer = await file.arrayBuffer();
        const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
        const textResult = await parser.getText();
        rawText = textResult.text;
        await parser.destroy();
      } else if (
        fileType === "text/plain" ||
        fileExtension === "txt"
      ) {
        rawText = await file.text();
      } else {
        return errorResponse(
          "Only PDF and text files are supported",
          400
        );
      }
    } else if (pastedText && pastedText.trim().length > 0) {
      rawText = pastedText.trim();
    } else {
      return errorResponse("Please provide text or upload a file", 400);
    }

    // Validate extracted text
    rawText = rawText.trim();
    if (rawText.length === 0) {
      return errorResponse(
        "Could not extract text from this file. The file may be image-based or empty.",
        400
      );
    }

    if (rawText.length > MAX_TEXT_SIZE) {
      // Truncate but don't reject — long docs are expected
      rawText = rawText.slice(0, MAX_TEXT_SIZE);
    }

    // Extract insights via OpenAI
    const extraction = await extractDocumentInsights(rawText);

    // Save to Supabase
    const { data: inserted, error: dbError } = await supabase
      .from("analyzed_documents")
      .insert({
        user_id: userId,
        file_name: fileName,
        raw_text: rawText,
        ...extraction,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      return errorResponse("Failed to save analysis results", 500);
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
