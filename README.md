# DocFlow

Production-grade document Q&A REST API. Upload a PDF, retrieve relevant passages with hybrid search, and stream grounded answers from a local LLM.

DocFlow keeps inference on your machine (Ollama) and stores vectors in Supabase with pgvector. No cloud LLM keys required.

## Stack

| Layer | Choice |
| --- | --- |
| API | [Hono](https://hono.dev/) on Node.js (TypeScript) |
| PDF parsing | [unpdf](https://github.com/unjs/unpdf) |
| Embeddings | Ollama `nomic-embed-text` |
| Generation | Ollama `llama3.1:8b` (token streaming) |
| Vector store | Supabase + [pgvector](https://github.com/pgvector/pgvector) |
| Auth | Bearer API key (`Authorization` header) |

## Architecture

```
                          ┌─────────────────────────────────────────┐
                          │                 Client                   │
                          │         (curl, SDK, frontend)            │
                          └──────────────────┬──────────────────────┘
                                             │
                         Bearer API key      │  HTTP
                         (except /health)    ▼
                          ┌─────────────────────────────────────────┐
                          │              DocFlow API                 │
                          │            Hono  :3000                   │
                          │                                          │
                          │   POST /ingestDocuments                  │
                          │   POST /query          GET /health       │
                          └───────┬───────────────────────┬─────────┘
                                  │                       │
                    ingest path   │                       │  query path
                                  ▼                       ▼
                    ┌─────────────────────┐   ┌─────────────────────────┐
                    │  unpdf extractText  │   │  embed(question)         │
                    │  500 / 50 chunker   │   │  nomic-embed-text        │
                    │  embed each chunk   │   └────────────┬────────────┘
                    └──────────┬──────────┘                │
                               │                           ▼
                               │              ┌─────────────────────────┐
                               │              │  Supabase RPC            │
                               │              │  match_chunks            │
                               │              │  70% vector + 30% keyword│
                               │              │  top 5 chunks            │
                               ▼              └────────────┬────────────┘
                    ┌─────────────────────┐                │
                    │  Supabase Postgres  │◄───────────────┘
                    │  documents + chunks │
                    │  pgvector embeddings│
                    └─────────────────────┘                │
                                                           ▼
                                              ┌─────────────────────────┐
                                              │  Ollama llama3.1:8b     │
                                              │  context + question     │
                                              │  stream tokens → client │
                                              └─────────────────────────┘
```

## RAG pipeline

1. **Ingest** — PDF uploaded → text extracted with unpdf → split into **500-character** chunks with **50-character** overlap.
2. **Index** — Each chunk is embedded with `nomic-embed-text` and stored in Supabase (`documents` + `chunks` with a pgvector column).
3. **Retrieve** — The user question is embedded, then **hybrid search** runs via `match_chunks`: **70% vector similarity + 30% keyword**. The **top 5** chunks are returned.
4. **Generate** — Retrieved chunks and the question are sent to `llama3.1:8b`. The model is instructed to answer **only from that context**. Tokens are streamed back to the client.

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

```bash
git clone <repo-url>
cd docflow
npm install
```

Create a `.env` file in the project root (never commit real credentials):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
API_KEY=your-secret-api-key
```

### Database

Enable pgvector and create tables plus the hybrid-search RPC. Typical schema:

- `documents` — `id`, `name`, `file_size`, `page_count`
- `chunks` — `id`, `document_id`, `raw_text`, `embedding vector`
- `match_chunks(query_embedding, query_text, match_count)` — hybrid score, returns the top `match_count` rows (default **5**)

Run the API:

```bash
npx tsx src/backend/index.ts
```

The server listens on **http://localhost:3000**.

## Authentication

All routes **except** `GET /health` require:

```http
Authorization: Bearer <API_KEY>
```

The key is compared to `process.env.API_KEY`. Missing or invalid tokens return `401 Unauthorized`.

## API

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

Ask a question over ingested documents. Response body is a **stream of tokens**, not a single JSON object.

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

The handler embeds the question, calls `match_chunks`, builds a grounded prompt, and streams `llama3.1:8b` output token by token.

If the answer is not in retrieved context, the model is prompted to reply: *I don't have enough information to answer that.*

## Project layout

```
src/backend/
  index.ts              # Hono routes, streaming, server
  ingest.ts             # Document insert + chunk embed loop
  chunker.ts            # 500 / 50 overlapping splits
  embeddings.ts         # Ollama nomic-embed-text
  llm.ts                # llama3.1:8b generate + stream
  db.ts                 # Supabase client
  middleware/auth.ts    # Bearer API key
```

## Configuration notes

| Setting | Value |
| --- | --- |
| Chunk size | 500 characters |
| Overlap | 50 characters |
| Retrieval | Hybrid 70% vector / 30% keyword |
| `match_count` | 5 |
| Embed model | `nomic-embed-text` |
| Chat model | `llama3.1:8b` |
| Ollama | `http://localhost:11434` |
| HTTP port | `3000` |

## License

ISC
