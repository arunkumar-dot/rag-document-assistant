import { Context, Hono } from 'hono';
import { serve } from '@hono/node-server'
import { embed } from './embeddings.js';
import { supabase } from './db.js';
import { chunkText } from './chunker.js';
import { ingestDocuments } from './ingest.js';
import { generate, generateStream } from './llm.js';
import { extractText } from 'unpdf';
import authMiddleware from './middleware/auth.js';
import { stream as HonoStream } from 'hono/streaming'
import { cors } from 'hono/cors'

const app = new Hono()



app.use("/*", cors({
  origin: ["http://localhost:3001"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "Accept"],
  exposeHeaders: ["Content-Type"],
}))

app.get("/health", (c) => c.json({ status: "ok" }))

app.use("/*", authMiddleware)

app.post("/ingestDocuments", async (c) => {
  try {
    const body = await c.req.formData()
    const file = body.get('file') as File
    const name = body.get('name') as string
    if (!file) {
      return c.json({
        error: "No file provided"
      }, 400)
    }
    if (!name) {
      return c.json({
        error: "No name provided"
      }, 400)
    }
    const buffer = await file.arrayBuffer()
    const { text } = await extractText(new Uint8Array(buffer))
    const content = text.join(' ')
    await ingestDocuments(name, content)
    return c.json({
      message: "Documents ingested successfully"
    }, 200)
  } catch (error) {
    return c.json({
      error: (error as Error).message
    }, 500)
  }
})

app.post("/query", async (c) => {
  try {
    const { question } = await c.req.json() as { question: string }
    const result = await embed(question)
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: result,
      query_text: question,
      match_count: 5,
    })
    if (error) {
      return c.json({
        error: error.message
      }, 500)
    }
    const texts = data.map((item: any) => item.raw_text)
    const sources = data.map((item: any) => ({
      document_id: item.document_id,
      document_name: item.document_name,
      similarity: parseFloat(item.similarity.toFixed(2)),
      preview: item.raw_text.slice(0, 150)
    }))
    const response = await generateStream(question, texts)

    return HonoStream(c, async (s) => {
      await s.write(JSON.stringify({ sources }) + '\n')

      let buffer = ''
      for await (const chunk of response.body as any) {
        buffer += new TextDecoder().decode(chunk)

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) {
            continue
          }
          try {
            const json = JSON.parse(line)
            if (json.response) {
              await s.write(json.response)
            }
          } catch (e) {
            console.error('Error parsing SSE chunk', e)
          }
        }
      }
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer)
          if (json.response) {
            await s.write(json.response)
          }
        } catch (e) {
          console.error('Error parsing SSE chunk', e)
        }
      }
      await s.close()
    })
  } catch (error) {
    return c.json({
      error: (error as Error).message
    }, 500)
  }
})

app.get("/documents", async (c) => {
  const { data, error } = await supabase
    .from('documents')
    .select('id, name, file_size, page_count, created_at, chunks(count)')
    .order('created_at', { ascending: false })
  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json(data, 200)
})

app.delete("/documents/:id", async (c) => {
  const id = c.req.param('id')

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)

  if (error) {
    return c.json({ error: error.message }, 500)
  }

  return c.json({ message: "Document deleted successfully" }, 200)
})


serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('Lumen running on http://localhost:3000')
})

