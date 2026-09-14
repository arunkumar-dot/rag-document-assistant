
export async function GET() {
    const apiResponse = await fetch("http://localhost:3000/documents", {
        headers: {
            "authorization": `Bearer ${process.env.API_KEY}`
        }
    })
    const data = await apiResponse.json()
    console.log("Backend response:", apiResponse.status, data)
    return Response.json(data, { status: apiResponse.status })
}