"use client";

import { useCallback, useEffect, useState } from "react";
import { listDocuments, deleteDocument, type Document } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch {
      showToast("Failed to load documents", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      showToast("Document deleted");
    } catch {
      showToast("Failed to delete document", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Documents</h1>
        <p className="mt-1 text-gray-600">Manage your uploaded documents.</p>
      </div>

      {loading && (
        <div className="flex flex-col gap-2">
          <div className="h-12 animate-pulse rounded-md bg-gray-100" />
          <div className="h-12 animate-pulse rounded-md bg-gray-100" />
        </div>
      )}

      {!loading && documents.length === 0 && (
        <p className="text-sm text-gray-500">No documents uploaded yet.</p>
      )}

      {!loading && documents.length > 0 && (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                <p className="text-xs text-gray-500">
                  {doc.chunks?.[0]?.count ?? 0} chunks · {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={deletingId === doc.id}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deletingId === doc.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
