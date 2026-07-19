import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const allowedOrigins = ["chrome-extension://dphihloimodjbiehebodobikkpkgadhh"];

export function proxy(request: NextRequest) {
    const origin = request.headers.get("origin") ?? "";
    console.log(origin);
    const isAllowed = allowedOrigins.includes(origin);

    if (request.method === "OPTIONS") {
        return new NextResponse(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": isAllowed ? origin : "",
                "Access-Control-Allow-Methods":
                    "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }

    const response = NextResponse.next();
    if (isAllowed) {
        response.headers.set("Access-Control-Allow-Origin", origin);
    }
    return response;
}

export const config = {
    matcher: "/api/:path*",
};
