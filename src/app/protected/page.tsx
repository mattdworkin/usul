"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DocumentUploader } from "@/components/documents/document-uploader";
import { DocumentResultCard } from "@/components/documents/document-result-card";
import { DocumentHistory } from "@/components/documents/document-history";
import { DocumentChat } from "@/components/documents/document-chat";
import { FileSearch, Upload, MessageCircle } from "lucide-react";
import type { AnalyzedDocument } from "@/lib/types";

export default function ProtectedPage() {
  const [activeTab, setActiveTab] = useState<
    "analyze" | "history" | "ask"
  >("analyze");
  const [lastResult, setLastResult] = useState<AnalyzedDocument | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [chatDocId, setChatDocId] = useState<string | undefined>();
  const [chatDocTitle, setChatDocTitle] = useState<string | undefined>();

  const handleSuccess = (doc: AnalyzedDocument) => {
    setLastResult(doc);
    setHistoryRefreshKey((k) => k + 1);
  };

  const handleAskAbout = (docId: string, docTitle: string) => {
    setChatDocId(docId);
    setChatDocTitle(docTitle);
    setActiveTab("ask");
  };

  const handleAskAll = () => {
    setChatDocId(undefined);
    setChatDocTitle(undefined);
    setActiveTab("ask");
  };

  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Document Insight Extractor
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload government procurement documents, extract structured insights,
          and ask questions with AI.
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
        <Button
          variant={activeTab === "ask" ? "default" : "outline"}
          size="sm"
          onClick={handleAskAll}
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Ask AI
        </Button>
      </div>

      {/* Content */}
      {activeTab === "analyze" && (
        <div className="space-y-6">
          <DocumentUploader onSuccess={handleSuccess} />

          {lastResult && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Analysis Result</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleAskAbout(lastResult.id, lastResult.title)
                  }
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Ask about this
                </Button>
              </div>
              <DocumentResultCard
                doc={lastResult}
                onAskAbout={handleAskAbout}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <DocumentHistory
          refreshKey={historyRefreshKey}
          onAskAbout={handleAskAbout}
        />
      )}

      {activeTab === "ask" && (
        <DocumentChat
          key={chatDocId || "all"}
          documentId={chatDocId}
          documentTitle={chatDocTitle}
        />
      )}
    </div>
  );
}
