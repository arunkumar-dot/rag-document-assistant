export async function POST(request: Request) {
    const formData = await request.formData()
    const apiResponse = await fetch("http://localhost:3000/ingestDocuments", {
        method: "POST",
        headers: {
            "authorization": `Bearer ${process.env.API_KEY}`
        },
        body: formData
    })
    const data = await apiResponse.json()
    return Response.json(data, { status: apiResponse.status })
}