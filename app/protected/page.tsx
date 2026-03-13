"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { DocumentResultCard } from "@/components/documents/document-result-card";
import { DocumentHistory } from "@/components/documents/document-history";
import { FileSearch, Upload } from "lucide-react";
import type { AnalyzedDocument } from "@/lib/types";

export default function ProtectedPage() {
  const [activeTab, setActiveTab] = useState<"analyze" | "history">("analyze");
  const [lastResult, setLastResult] = useState<AnalyzedDocument | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const handleSuccess = (doc: AnalyzedDocument) => {
    setLastResult(doc);
    // Increment key so history refetches when user switches tab
    setHistoryRefreshKey((k) => k + 1);
  };

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Document Insight Extractor
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload government procurement documents and extract structured
          insights with AI.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "analyze" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("analyze")}
        >
          <Upload className="h-4 w-4 mr-2" />
          Analyze
        </Button>
        <Button
          variant={activeTab === "history" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("history")}
        >
          <FileSearch className="h-4 w-4 mr-2" />
          History
        </Button>
      </div>

      {/* Content */}
      {activeTab === "analyze" && (
        <div className="space-y-6">
          <DocumentUploader onSuccess={handleSuccess} />

          {lastResult && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Analysis Result</h2>
              <DocumentResultCard doc={lastResult} />
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <DocumentHistory refreshKey={historyRefreshKey} />
      )}
    </div>
  );
}
