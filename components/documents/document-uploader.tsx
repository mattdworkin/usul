"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import type { AnalyzedDocument, AnalyzeResponse } from "@/lib/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentUploader({
  onSuccess,
}: {
  onSuccess: (doc: AnalyzedDocument) => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE) {
      setError("File exceeds 10MB limit");
      return;
    }

    const ext = selected.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "txt") {
      setError("Only PDF and text files are supported");
      return;
    }

    setFile(selected);
    setError(null);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!file && !text.trim()) {
      setError("Please provide text or upload a file");
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("text", text);
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const result: AnalyzeResponse = await response.json();

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Clear inputs on success
      setText("");
      clearFile();
      onSuccess(result.document);
    } catch {
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const hasInput = file || text.trim().length > 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* File upload */}
        <div>
          <label className="text-sm font-medium mb-2 block">
            Upload Document
          </label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            {file && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{file.name}</span>
                <button
                  onClick={clearFile}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {!file && (
              <span className="text-sm text-muted-foreground">
                PDF or TXT, up to 10MB
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t" />
          <span className="text-xs text-muted-foreground">or paste text</span>
          <div className="flex-1 border-t" />
        </div>

        {/* Text input */}
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your government document text here..."
            rows={6}
            disabled={isLoading || !!file}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
          {file && (
            <p className="text-xs text-muted-foreground mt-1">
              Text input disabled while a file is selected
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={isLoading || !hasInput}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing Document...
            </>
          ) : (
            "Analyze Document"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
