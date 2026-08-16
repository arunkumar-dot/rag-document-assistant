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
  allowHeaders: ["Content-Type", "Authorization"],
}))

app.get("/health", (c) => c.json({ status: "ok" }))

app.use("/*", authMiddleware)

app.post("/documents", async (c) => {
  const body = await c.req.json()
  const { data, error } = await supabase.from('documents').insert(body).select()
  if (error) {
    return c.json({
      error: error.message
    }, 500)
  }
  return c.json(data, 201)
})

app.post("/ingestDocuments", async (c) => {
  try {
    const body = await c.req.formData()
    const file = body.get('file') as File
    const name = body.get('name') as string
    if(!file){
      return c.json({
        error: "No file provided"
      }, 400)
    }
    if(!name){
      return c.json({
        error: "No name provided"
      }, 400)
    }
    const buffer =  await file.arrayBuffer()
    const {text} = await extractText(new Uint8Array(buffer))
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

app.post("/query", async (c)  => {
  try {
    const {question} = await c.req.json() as {question:string}
  const result = await embed(question)
  const {data,error} = await supabase.rpc('match_chunks',{
    query_embedding : result,
    query_text : question,
    match_count : 5,
  })
  if(error){
    return c.json({
      error: error.message
    }, 500)
  }
  const texts = data.map((item: any) => item.raw_text)
  const response = await generateStream(question, texts)

  return HonoStream(c, async (s) => {
    for await (const chunk of response.body as any) {
      const text = new TextDecoder().decode(chunk)
      try{
        const json = JSON.parse(text)
        if(json.response) {
          await s.write(json.response)
        }
      } catch (error) {
        await s.write(text)
      }
    }
  })
  } catch (error) {
    return c.json({
      error: (error as Error).message
    }, 500)
  }
})


serve({ fetch: app.fetch, port: 3000 }, () => {
  console.log('Lumen running on http://localhost:3000')
})

