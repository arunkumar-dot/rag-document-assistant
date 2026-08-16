import type { MiddlewareHandler } from "hono/types"


const authMiddleware:MiddlewareHandler = async (c,next) => {
    const authHeader = c.req.header("Authorization") as string
    if(!authHeader){
        return c.json({error: "Unauthorized"}, 401)
    }
    const token = authHeader.split(" ")[1]
    if(!token){
        return c.json({
            error: "Unauthorized"
        }, 401)
    }
    if(token !== process.env.API_KEY){
        return c.json({
            error: "Unauthorized"
        }, 401)
    }
    await next()
}

export default authMiddleware   