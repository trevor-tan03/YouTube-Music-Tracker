import { sqliteDb } from "@/src/lib/database/database";
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

        const artist = sqliteDb
            .prepare(`SELECT id FROM artist WHERE id = ?`)
            .get(artistId) as { id: number } | undefined;
        if (!artist) {
            return NextResponse.json(
                { error: "Artist not found" },
                { status: 404 },
            );
        }

        const video = sqliteDb
            .prepare(`SELECT id FROM video WHERE id = ?`)
            .get(videoId);
        if (!video) {
            return NextResponse.json(
                { error: "Video not found" },
                { status: 404 },
            );
        }

        sqliteDb
            .prepare(
                `INSERT OR REPLACE INTO artist_song (video_id, artist_id, mapping_type) VALUES (?, ?, ?)`,
            )
            .run(videoId, artist.id, "unknown");

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
