# Lumen Frontend

A minimal Next.js frontend for the Lumen document Q&A API — upload PDFs and ask
questions about them with streamed, word-by-word answers.

## Getting started

The Lumen API (in `../src/backend`) must be running on `http://localhost:3000`.

```bash
npm install
npm run dev
```

The frontend runs on [http://localhost:3001](http://localhost:3001) (port 3001, since
the backend already uses 3000).

## Configuration

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_API_URL` — base URL of the Lumen API (defaults to `http://localhost:3000`)
- `NEXT_PUBLIC_API_KEY` — bearer token sent as `Authorization: Bearer <key>`

## Pages

- `/upload` — drag-and-drop PDF upload with a name field
- `/query` — ask a question and watch the answer stream in
