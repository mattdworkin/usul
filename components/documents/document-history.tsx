"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, FileText } from "lucide-react";
import { DocumentResultCard } from "./document-result-card";
import type { AnalyzedDocument, DocumentsResponse } from "@/lib/types";

function SkeletonCard() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-3 animate-pulse">
      <div className="h-5 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-1/4" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-5/6" />
    </div>
  );
}

export function DocumentHistory({
  refreshKey,
}: {
  refreshKey?: number;
}) {
  const [documents, setDocuments] = useState<AnalyzedDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchDocuments = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = query ? `?q=${encodeURIComponent(query)}` : "";
      const response = await fetch(`/api/documents${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch");
      }

      const data: DocumentsResponse = await response.json();
      setDocuments(data.documents);
    } catch {
      setError("Failed to load documents. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and when refreshKey changes
  useEffect(() => {
    fetchDocuments(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchDocuments(value);
    }, 300);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search documents..."
          className="pl-9"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Results */}
      {!isLoading && !error && documents.length > 0 && (
        <div className="space-y-4">
          {documents.map((doc) => (
            <DocumentResultCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}

      {/* Empty states */}
      {!isLoading && !error && documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
          {searchQuery ? (
            <>
              <h3 className="text-lg font-medium">No results found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No documents match &quot;{searchQuery}&quot;. Try a different
                search term.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium">No documents yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your first document to get started.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
