
export async function POST(request: Request) {
    const { question } = await request.json()
    const apiResponse = await fetch("http://localhost:3000/query", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "authorization": `Bearer ${process.env.API_KEY}`
        },
        body: JSON.stringify({ question })
    })
    return new Response(apiResponse.body, {
        headers: {
            "Content-Type": "text/plain"
        }
    })
}

