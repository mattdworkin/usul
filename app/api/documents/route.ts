import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();

    if (authError || !claimsData?.claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = claimsData.claims.sub as string;
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim() || "";
    const mode = searchParams.get("mode") || "keyword"; // "keyword" | "semantic"

    // Semantic search mode — uses pgvector embeddings
    if (mode === "semantic" && query) {
      const queryEmbedding = await generateEmbedding(query);

      const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_user_id: userId,
        match_threshold: 0.3,
        match_count: 20,
      });

      if (error) {
        console.error("Semantic search error:", error);
        return NextResponse.json(
          { error: "Semantic search failed" },
          { status: 500 }
        );
      }

      // Fetch full documents for matched IDs
      if (data && data.length > 0) {
        const ids = data.map((d: { id: string }) => d.id);
        const { data: fullDocs, error: fetchError } = await supabase
          .from("analyzed_documents")
          .select("*")
          .in("id", ids);

        if (fetchError) {
          console.error("Fetch error:", fetchError);
          return NextResponse.json(
            { error: "Failed to fetch documents" },
            { status: 500 }
          );
        }

        // Maintain similarity ordering
        const docMap = new Map(
          (fullDocs || []).map((d: { id: string }) => [d.id, d])
        );
        const ordered = ids
          .map((id: string) => docMap.get(id))
          .filter(Boolean);

        return NextResponse.json({ documents: ordered });
      }

      return NextResponse.json({ documents: [] });
    }

    // Keyword search mode (default) — uses SQL ILIKE
    let dbQuery = supabase
      .from("analyzed_documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (query) {
      dbQuery = dbQuery.or(
        `title.ilike.%${query}%,summary.ilike.%${query}%,issuing_organization.ilike.%${query}%,solicitation_or_tracking_number.ilike.%${query}%,document_type.ilike.%${query}%`
      );
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error("Database query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    return NextResponse.json({ documents: data });
  } catch (err) {
    console.error("Documents fetch error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
