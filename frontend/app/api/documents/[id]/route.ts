
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    const { id } = await params
    const apiResponse = await fetch(`http://localhost:3000/documents/${id}`, {
        method: "DELETE",
        headers: {
            "authorization": `Bearer ${process.env.API_KEY}`
        }
    })
    const data = await apiResponse.json()
    return Response.json(data, { status: apiResponse.status })
}