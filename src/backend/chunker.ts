

export function chunkText(text:string,chunkSize:number,overlap: number): string[]{

   let start = 0
   const results : string[] = []
   while(start < text.length){
    let chunk = text.slice(start,start + chunkSize)
    results.push(chunk)
    start = start + chunkSize - overlap
   }
    return results
}