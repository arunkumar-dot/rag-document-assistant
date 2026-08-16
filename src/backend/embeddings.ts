
const OLLAMA_URL ='http://localhost:11434' 

interface OllamaEmbedResponse {
  embeddings: number[][];
}

export async function embed(text:string):Promise<number[]>{
    const response = await fetch(`${OLLAMA_URL}/api/embed`, {
        method:'POST',
        headers:{'Content-Type': 'application/json'},
        body:JSON.stringify({
            model:'nomic-embed-text',
            input:text,
        })
    })

    const data = (await response.json()) as OllamaEmbedResponse
    return data.embeddings[0] ?? []
}