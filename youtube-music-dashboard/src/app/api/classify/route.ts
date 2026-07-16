import { sqliteDb } from "@/src/lib/database/database";
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

        const existingVideo = sqliteDb
            .prepare("SELECT id FROM video WHERE id = ?")
            .get(videoId);

        if (!existingVideo) {
            return NextResponse.json(
                { error: "Video with specified id does not exist" },
                { status: 404 },
            );
        }

        sqliteDb
            .prepare("UPDATE video SET is_song = ? WHERE id = ?")
            .run(isSong ? 1 : 0, videoId);

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
