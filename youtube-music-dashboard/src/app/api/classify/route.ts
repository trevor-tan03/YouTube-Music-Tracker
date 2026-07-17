import { db } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { videoId, isSong } = await request.json();

        if (!videoId || isSong === undefined) {
            return NextResponse.json(
                {
                    error: "Missing required fields: videoId, isSong",
                },
                { status: 400 },
            );
        }

        const existingVideo = await db
            .selectFrom("video")
            .select("id")
            .where("video.id", "=", videoId)
            .executeTakeFirstOrThrow();

        if (!existingVideo) {
            return NextResponse.json(
                { error: "Video with specified id does not exist" },
                { status: 404 },
            );
        }

        await db
            .updateTable("video")
            .set({
                is_song: isSong ? 1 : 0,
            })
            .where("video.id", "=", existingVideo.id)
            .executeTakeFirstOrThrow();

        return NextResponse.json({
            message: `isSong has been set to: ${isSong}`,
            isSong,
        });
    } catch {
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 },
        );
    }
}
