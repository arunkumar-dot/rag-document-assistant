"use client";

import { useRef, useState } from "react";
import { ingestDocument } from "@/lib/api";
import { useToast } from "@/components/Toast";

type Status = "idle" | "uploading" | "success" | "error";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const isBusy = status === "uploading";

  function pickFile(candidate: File | null) {
    if (!candidate) return;
    if (candidate.type !== "application/pdf") {
      showToast("Only PDF files are supported.", "error");
      return;
    }
    setFile(candidate);
    if (!name) setName(candidate.name.replace(/\.pdf$/i, ""));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    pickFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function handleUpload() {
    if (!file || !name.trim() || isBusy) return;

    setStatus("uploading");
    setErrorMessage("");

    try {
      const result = await ingestDocument(file, name.trim());
      setStatus("success");
      showToast(result.message || "Documents ingested successfully");
      setFile(null);
      setName("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setStatus("error");
      setErrorMessage(message);
      showToast(message, "error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Upload</h1>
        <p className="mt-1 text-gray-600">Add a PDF document to your library.</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center ${
          isDragActive ? "border-indigo-400 bg-indigo-50" : "border-gray-300"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <>
            <p className="font-medium text-gray-900">{file.name}</p>
            <p className="mt-1 text-sm text-gray-500">{(file.size / 1024).toFixed(0)} KB — click or drop to replace</p>
          </>
        ) : (
          <>
            <p className="font-medium text-gray-900">Drag and drop a PDF here</p>
            <p className="mt-1 text-sm text-gray-500">or click to browse</p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="doc-name" className="text-sm font-medium text-gray-700">
          Document name
        </label>
        <input
          id="doc-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Q3 Financial Report"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleUpload}
          disabled={!file || !name.trim() || isBusy}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {isBusy ? "Uploading & processing..." : "Upload"}
        </button>
        {status === "error" && <p className="text-sm text-red-600">{errorMessage}</p>}
      </div>
    </div>
  );
}
