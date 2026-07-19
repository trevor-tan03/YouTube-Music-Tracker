import { db } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { videoId, artistId } = await request.json();

        if (!videoId || !artistId) {
            return NextResponse.json(
                { error: "Both videoId and artistId are required" },
                { status: 400 },
            );
        }

        const artist = await db
            .selectFrom("artist")
            .select("artist.id")
            .where("artist.id", "=", artistId)
            .executeTakeFirstOrThrow();

        if (!artist) {
            return NextResponse.json(
                { error: "Artist not found" },
                { status: 404 },
            );
        }

        const video = await db
            .selectFrom("video")
            .select("video.id")
            .where("video.id", "=", videoId)
            .executeTakeFirstOrThrow();

        if (!video) {
            return NextResponse.json(
                { error: "Video not found" },
                { status: 404 },
            );
        }

        await db
            .insertInto("artist_video")
            .values({
                video_id: videoId,
                artist_id: artist.id,
                mapping_type: "manual",
            })
            .onConflict((oc) =>
                oc
                    // 1. Specify the column(s) that trigger the conflict (e.g., video_id)
                    .column("video_id")
                    // 2. Define what to update if that conflict happens
                    .doUpdateSet({
                        artist_id: artist.id,
                        mapping_type: "manual",
                    }),
            )
            .execute();

        return NextResponse.json({
            message: "Artist mapped to video successfully",
        });
    } catch {
        return NextResponse.json(
            {
                error: "An error occurred while mapping artist to video",
            },
            { status: 500 },
        );
    }
}
