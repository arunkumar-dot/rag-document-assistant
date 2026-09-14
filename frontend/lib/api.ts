const API_BASE = ""

export type Source = {
  document_id: string
  document_name: string
  similarity: number
  preview: string
}

export type Document = {
  id: string
  name: string
  file_size: number
  page_count: number
  created_at: string
  chunks: { count: number }[]
}

export async function listDocuments(): Promise<Document[]> {
  const res = await fetch(`/api/documents`);
  if (!res.ok) throw new Error(await readErrorMessage(res))
  return res.json()
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await readErrorMessage(res))
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error) return data.error;
  } catch {
    // response body wasn't JSON — fall through to the status text below
  }
  return `Request failed with status ${res.status}`;
}

export async function ingestDocument(file: File, name: string): Promise<{ message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("name", name);

  const res = await fetch(`/api/ingest`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return res.json();
}

export async function streamQuery(
  question: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  onSources?: (sources: Source[]) => void
): Promise<void> {
  const res = await fetch(`/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(await readErrorMessage(res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = ""
  let isFirstLine = true

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue

      if (isFirstLine && line.startsWith('{"sources"')) {
        isFirstLine = false
        try {
          const json = JSON.parse(line)
          onSources?.(json.sources)
        } catch {
          // malformed sources line, skip
        }
      } else {
        isFirstLine = false
        onChunk(line + '\n')
      }
    }
  }

  if (buffer.trim()) {
    if (isFirstLine && buffer.startsWith('{"sources"')) {
      try {
        const json = JSON.parse(buffer)
        onSources?.(json.sources)
      } catch {
        // malformed sources line, skip
      }
    } else {
      onChunk(buffer)
    }
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === "ok";
  } catch {
    return false;
  }
}
