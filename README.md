# Lumen

Production-grade document Q&A REST API. Upload a PDF, retrieve relevant passages with hybrid search, and stream grounded answers from a local LLM.

Lumen keeps inference on your machine (Ollama) and stores vectors in Supabase with pgvector. No cloud LLM keys required.

A Next.js frontend (Upload / Query / Documents) sits in front of the API. It proxies every request through server-side route handlers so the Supabase-backed API key never reaches the browser.

## Stack

| Layer | Choice |
| --- | --- |
| API | [Hono](https://hono.dev/) on Node.js (TypeScript) |
| Frontend | [Next.js 14](https://nextjs.org/) (App Router), React 18, Tailwind CSS |
| PDF parsing | [unpdf](https://github.com/unjs/unpdf) |
| Embeddings | Ollama `nomic-embed-text` |
| Generation | Ollama `llama3.1:8b` (token streaming) |
| Vector store | Supabase + [pgvector](https://github.com/pgvector/pgvector) with an HNSW index |
| Auth | Bearer API key (`Authorization` header), held server-side only |

## Architecture

```
                          ┌─────────────────────────────────────────┐
                          │                 Browser                  │
                          │        Upload · Query · Documents        │
                          └──────────────────┬──────────────────────┘
                                             │  same-origin fetch
                                             │  (no API key here)
                                             ▼
                          ┌─────────────────────────────────────────┐
                          │           Next.js Frontend                │
                          │             App Router :3001              │
                          │                                          │
                          │  /api/ingest      /api/query              │
                          │  /api/documents   /api/documents/:id      │
                          │  (route handlers attach the API key,      │
                          │   proxy to the backend, stream responses) │
                          └──────────────────┬──────────────────────┘
                                             │
                         Bearer API key      │  HTTP
                         (except /health)    ▼
                          ┌─────────────────────────────────────────┐
                          │               Lumen API                  │
                          │            Hono  :3000                   │
                          │                                          │
                          │   POST /ingestDocuments   GET /health     │
                          │   POST /query                             │
                          │   GET /documents   DELETE /documents/:id  │
                          └───────┬───────────────────────┬─────────┘
                                  │                       │
                    ingest path   │                       │  query path
                                  ▼                       ▼
                    ┌─────────────────────┐   ┌─────────────────────────┐
                    │  unpdf extractText  │   │  embed(question)         │
                    │  500 / 50 chunker   │   │  nomic-embed-text        │
                    │  replace existing   │   └────────────┬────────────┘
                    │  doc + embed chunks │                │
                    └──────────┬──────────┘                ▼
                               │              ┌─────────────────────────┐
                               │              │  Supabase RPC            │
                               │              │  match_chunks            │
                               │              │  HNSW ANN + keyword      │
                               │              │  70% vector + 30% keyword│
                               │              │  top 5 chunks + sources  │
                               ▼              └────────────┬────────────┘
                    ┌─────────────────────┐                │
                    │  Supabase Postgres  │◄───────────────┘
                    │  documents + chunks │
                    │  pgvector + HNSW    │
                    └─────────────────────┘                │
                                                           ▼
                                              ┌─────────────────────────┐
                                              │  Ollama llama3.1:8b     │
                                              │  context + question     │
                                              │  line-buffered NDJSON   │
                                              │  stream → sources+tokens│
                                              └─────────────────────────┘
```

## RAG pipeline

1. **Ingest** — PDF uploaded → text extracted with unpdf → split into **500-character** chunks with **50-character** overlap. If a document with the same `name` already exists, it (and its chunks) is deleted first, so re-uploads replace rather than duplicate.
2. **Index** — Each chunk is embedded with `nomic-embed-text` and stored in Supabase (`documents` + `chunks` with a pgvector column, backed by an HNSW index).
3. **Retrieve** — The user question is embedded, then **hybrid search** runs via `match_chunks`: **70% vector similarity (HNSW ANN) + 30% keyword**. The **top 5** chunks are returned along with their source document and similarity score.
4. **Generate** — Retrieved chunks and the question are sent to `llama3.1:8b`. The model is instructed to answer **only from that context**. The response is streamed back as a `sources` JSON line followed by answer tokens.

## Prerequisites

- Node.js 20+
- [Ollama](https://ollama.com/) running locally (`http://localhost:11434`)
- A Supabase project with the `pgvector` extension enabled

Pull the local models:

```bash
ollama pull nomic-embed-text
ollama pull llama3.1:8b
```

## Setup

### Backend

```bash
git clone <repo-url>
cd lumen
npm install
```

Create a `.env` file in the project root (never commit real credentials):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
API_KEY=your-secret-api-key
```

Run the API:

```bash
npx tsx src/backend/index.ts
```

The server listens on **http://localhost:3000**.

### Frontend

```bash
cd frontend
npm install
```

Create a `.env.local` file in `frontend/` — the same `API_KEY` as the backend, read only by the server-side route handlers, never exposed to the client bundle:

```env
API_KEY=your-secret-api-key
```

```bash
npm run dev
```

The frontend listens on **http://localhost:3001**.

### Database

Enable pgvector and create tables plus the hybrid-search RPC. Typical schema:

- `documents` — `id`, `name`, `file_size`, `page_count`, `created_at`
- `chunks` — `id`, `document_id`, `raw_text`, `embedding vector`
- `match_chunks(query_embedding, query_text, match_count)` — hybrid score, returns the top `match_count` rows (default **5**), including `document_id`, `document_name`, and `similarity`

Add an HNSW index on the embedding column for approximate nearest-neighbor search:

```sql
create index on chunks
  using hnsw (embedding vector_cosine_ops);
```

## Authentication

All routes **except** `GET /health` require:

```http
Authorization: Bearer <API_KEY>
```

The key is compared to `process.env.API_KEY`. Missing or invalid tokens return `401 Unauthorized`.

The browser never holds this key. The Next.js route handlers under `frontend/app/api/*` read `API_KEY` from server-side environment variables and attach it when proxying to the Hono backend — the client only ever calls same-origin `/api/*` routes.

## API

Direct backend routes (`http://localhost:3000`). The frontend calls these through its own `/api/*` proxy routes instead of hitting them directly.

### `GET /health`

Liveness check. No auth.

```bash
curl http://localhost:3000/health
```

### `POST /ingestDocuments`

Upload a PDF. Multipart form fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | file | yes | PDF document |
| `name` | string | yes | Display name stored on the document row |

Re-uploading a `name` that already exists deletes the previous document and its chunks before inserting the new ones.

```bash
curl -X POST http://localhost:3000/ingestDocuments \
  -H "Authorization: Bearer $API_KEY" \
  -F "name=quarterly-report.pdf" \
  -F "file=@./quarterly-report.pdf"
```

**200**

```json
{ "message": "Documents ingested successfully" }
```

**400** if `file` or `name` is missing. **500** on parse, embed, or database errors.

### `POST /query`

Ask a question over ingested documents. Response body is a **stream**: a single JSON line with `sources`, followed by plain-text answer tokens — not a single JSON object.

```bash
curl -N -X POST http://localhost:3000/query \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"question":"What were the main findings in Q3?"}'
```

**Request**

```json
{ "question": "Your question here" }
```

**Stream**

```
{"sources":[{"document_id":"...","document_name":"quarterly-report.pdf","similarity":0.87,"preview":"Revenue grew 12%..."}]}
Revenue in Q3 grew 12% year over year, driven primarily by...
```

The handler embeds the question, calls `match_chunks`, writes the `sources` line, then builds a grounded prompt and streams `llama3.1:8b` output token by token.

If the answer is not in retrieved context, the model is prompted to reply: *I don't have enough information to answer that.*

### `GET /documents`

List all ingested documents with their chunk counts.

```bash
curl http://localhost:3000/documents \
  -H "Authorization: Bearer $API_KEY"
```

**200**

```json
[
  {
    "id": "b1f2...",
    "name": "quarterly-report.pdf",
    "file_size": 48213,
    "page_count": 1,
    "created_at": "2026-08-01T10:00:00Z",
    "chunks": [{ "count": 24 }]
  }
]
```

### `DELETE /documents/:id`

Delete a document and cascade-delete its associated chunks.

```bash
curl -X DELETE http://localhost:3000/documents/b1f2... \
  -H "Authorization: Bearer $API_KEY"
```

**200**

```json
{ "message": "Document deleted successfully" }
```

**500** on database errors.

## Frontend

Next.js 14 App Router app with three pages:

| Page | Route | Purpose |
| --- | --- | --- |
| Upload | `/upload` | Drag-and-drop PDF upload; on success, automatically streams a 3-4 sentence summary and 5 suggested questions inline |
| Query | `/query` | Ask a question, watch the answer render word by word, view deduplicated source cards (document name, similarity %, text preview) below the answer |
| Documents | `/documents` | List uploaded documents with chunk counts, delete individual documents |

Query and upload responses show elapsed time and word count once streaming completes.

Route handlers (`frontend/app/api/*`) are the only part of the frontend that knows `API_KEY`; every page and component calls same-origin `/api/*` paths.

## Project layout

```
src/backend/
  index.ts              # Hono routes, streaming, server
  ingest.ts             # Duplicate-name replace + chunk embed loop
  chunker.ts            # 500 / 50 overlapping splits
  embeddings.ts         # Ollama nomic-embed-text
  llm.ts                # llama3.1:8b generate + stream
  db.ts                 # Supabase client
  middleware/auth.ts    # Bearer API key

frontend/
  app/
    api/
      ingest/route.ts         # Proxies POST /ingestDocuments
      query/route.ts          # Proxies POST /query, forwards the stream
      documents/route.ts      # Proxies GET /documents
      documents/[id]/route.ts # Proxies DELETE /documents/:id
    upload/page.tsx     # Upload UI + auto summary
    query/page.tsx      # Query UI + source cards
    documents/page.tsx  # Document list + delete
  lib/api.ts             # Fetch helpers, NDJSON stream parser
  components/            # Nav, Toast
```

## Key engineering decisions

**API keys are proxied server-side, not sent from the browser.** The original version had the frontend call the Hono API directly with the `Authorization` header attached client-side, which shipped the API key in every browser request. Route handlers under `frontend/app/api/*` now hold the key as a server-only environment variable and forward requests to the backend, so the key never appears in client-side JavaScript or network requests visible to the browser.

**HNSW over brute-force vector search.** `match_chunks` originally did a sequential scan over all chunk embeddings for every query, which is O(n) per query and degrades as the corpus grows. An HNSW index (`vector_cosine_ops`) turns this into approximate nearest-neighbor search, keeping retrieval fast as the number of ingested documents scales, at the cost of exactness (HNSW is approximate, not exhaustive).

**Streaming uses a line buffer, not naive per-chunk `JSON.parse`.** Ollama emits newline-delimited JSON, but TCP/HTTP chunk boundaries don't align with message boundaries — a single `response.body` chunk can contain a partial JSON object, or several complete ones. Parsing each raw chunk directly throws on split objects. Both `src/backend/index.ts` (backend → frontend) and `frontend/lib/api.ts` (frontend → browser) instead accumulate chunks into a buffer, split on `\n`, hold back the last (possibly incomplete) line, and only parse complete lines.

## Configuration notes

| Setting | Value |
| --- | --- |
| Chunk size | 500 characters |
| Overlap | 50 characters |
| Retrieval | Hybrid 70% vector (HNSW ANN) / 30% keyword |
| `match_count` | 5 |
| Embed model | `nomic-embed-text` |
| Chat model | `llama3.1:8b` |
| Ollama | `http://localhost:11434` |
| Backend port | `3000` |
| Frontend port | `3001` |

## License

ISC
