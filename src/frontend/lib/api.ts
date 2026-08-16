const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

function authHeaders(): HeadersInit {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
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

  const res = await fetch(`${API_BASE}/ingestDocuments`, {
    method: "POST",
    headers: authHeaders(),
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
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ question }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(await readErrorMessage(res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) onChunk(decoder.decode(value, { stream: true }));
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
