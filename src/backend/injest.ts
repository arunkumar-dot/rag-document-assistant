import { supabase } from "./db.js";
import { chunkText } from "./chunker.js";
import { embed } from "./embeddings.js";

export async function ingestDocuments(name: string, content: string): Promise<void> {

    const {data, error} =  await supabase.from('documents').insert(
        {
            name,
            file_size : content.length,
            page_count : 1,
        }).select().single()
    if(error){
        throw error
    }
    const documentId = data.id
    const chunks = chunkText(content,500,50)
    for(const [i, chunk] of chunks.entries()){
        const embedding = await embed(chunk)
        const {data,error} = await supabase.from('chunks').insert({
            document_id : documentId,
            raw_text : chunk,
            embedding : embedding,
        })
        if(error){
            throw error
        }
        console.log(`Ingested chunk ${i+1} of ${chunks.length}`)
    }
}
