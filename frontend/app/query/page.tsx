"use client";

import { useRef, useState } from "react";
import { streamQuery } from "@/lib/api";

type Status = "idle" | "waiting" | "streaming" | "done" | "error";

export default function QueryPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isBusy = status === "waiting" || status === "streaming";

  async function handleSubmit() {
    if (!question.trim() || isBusy) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("waiting");
    setAnswer("");
    setErrorMessage("");
    setElapsedMs(null);
    const start = performance.now();

    try {
      let receivedFirstToken = false;
      await streamQuery(
        question.trim(),
        (chunk) => {
          if (!receivedFirstToken) {
            receivedFirstToken = true;
            setStatus("streaming");
          }
          setAnswer((prev) => prev + chunk);
        },
        controller.signal
      );
      setElapsedMs(performance.now() - start);
      setStatus("done");
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Something went wrong";
      setErrorMessage(message);
      setStatus("error");
    }
  }

  function handleClear() {
    abortRef.current?.abort();
    setQuestion("");
    setAnswer("");
    setStatus("idle");
    setErrorMessage("");
    setElapsedMs(null);
  }

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Query</h1>
        <p className="mt-1 text-gray-600">Ask a question about your uploaded documents.</p>
      </div>

      <div className="flex flex-col gap-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="What would you like to know?"
          rows={3}
          className="resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={!question.trim() || isBusy}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {isBusy ? "Asking..." : "Ask"}
          </button>
          <button
            onClick={handleClear}
            disabled={!question && !answer && status === "idle"}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {status === "waiting" && (
        <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-4">
          <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200" />
        </div>
      )}

      {status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {(status === "streaming" || status === "done") && (
        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-gray-200 p-4 text-sm leading-relaxed text-gray-900 whitespace-pre-wrap">
            {answer}
            {status === "streaming" && (
              <span className="cursor-blink ml-0.5 inline-block h-4 w-2 -translate-y-0.5 bg-gray-900 align-middle" />
            )}
          </div>
          {status === "done" && (
            <p className="text-xs text-gray-500">
              {wordCount} words · {(elapsedMs! / 1000).toFixed(1)}s
            </p>
          )}
        </div>
      )}
    </div>
  );
}
