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
            .executeTakeFirst();

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
            .execute();

        await db
            .insertInto("video_song_classification_history")
            .values({
                video_id: videoId,
                is_song: isSong ? 1 : 0,
                type: "manual",
            })
            .execute();

        // If the video is no longer classified as a song, it shouldn't
        // be attributed to any artist anymore
        if (!isSong) {
            await db
                .deleteFrom("artist_video")
                .where("video_id", "=", videoId)
                .execute();
        }

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
