import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
