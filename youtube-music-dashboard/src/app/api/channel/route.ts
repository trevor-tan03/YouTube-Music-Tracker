import { db } from "@/src/lib/database/database"; // adjust to wherever your Kysely instance lives
import { NextRequest, NextResponse } from "next/server";

// POST /api/channels/avatar
// Body: { videoId: string, avatar: string }
export async function POST(request: NextRequest) {
    let body: { videoId?: unknown; avatar?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 },
        );
    }

    const { videoId, avatar } = body;

    if (typeof videoId !== "string" || videoId.trim() === "") {
        return NextResponse.json(
            { error: "`videoId` must be a non-empty string" },
            { status: 400 },
        );
    }

    if (typeof avatar !== "string" || avatar.trim() === "") {
        return NextResponse.json(
            { error: "`avatar` must be a non-empty string" },
            { status: 400 },
        );
    }

    try {
        // Look up the channel_id for this video first
        const video = await db
            .selectFrom("video")
            .select("channel_id")
            .where("id", "=", videoId)
            .executeTakeFirst();

        if (!video) {
            return NextResponse.json(
                { error: "Video not found" },
                { status: 404 },
            );
        }

        if (video.channel_id === null) {
            return NextResponse.json(
                { error: "Video has no associated channel" },
                { status: 422 },
            );
        }

        const updated = await db
            .updateTable("channel")
            .set({ avatar })
            .where("id", "=", video.channel_id)
            .returningAll()
            .executeTakeFirst();

        if (!updated) {
            return NextResponse.json(
                { error: "Channel not found" },
                { status: 404 },
            );
        }

        return NextResponse.json(updated, { status: 200 });
    } catch (err) {
        console.error("Failed to update channel avatar:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
