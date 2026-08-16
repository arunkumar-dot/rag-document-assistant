const OLLAMA_URL = 'http://localhost:11434'

export async function generate(question: string, context: string[]): Promise<string> {
  const contextText = context.join('\n\n')

  const prompt = `You are a helpful assistant. Answer the question using ONLY the context provided below.
If the answer is not in the context, say "I don't have enough information to answer that."

Context:
${contextText}

Question: ${question}

Answer:`

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.1:8b',
      prompt,
      stream: false
    })
  })

  const data = await response.json() as { response: string }
  return data.response
}

export async function generateStream(question: string, context: string[]): Promise<Response> {
  const contextText = context.join('\n\n')
  
  const prompt = `You are a helpful assistant. Answer the question using ONLY the context provided below.
If the answer is not in the context, say "I don't have enough information to answer that."

Context:
${contextText}

Question: ${question}

Answer:`

  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.1:8b',
      prompt,
      stream: true
    })
  })

  return response
}