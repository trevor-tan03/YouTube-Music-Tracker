import { sqliteDb } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { title, channel, description, videoId, thumbnailUrl, genre } =
            await request.json();

        if (!videoId || !title || !channel || !description) {
            return NextResponse.json(
                {
                    error: "Missing required fields: videoId, title, channel, description",
                },
                { status: 400 },
            );
        }

        const existingVideo = sqliteDb
            .prepare(`SELECT * FROM video WHERE id = ?`)
            .get(videoId) as
            | { id: string; title: string; is_song: number }
            | undefined;

        if (existingVideo) {
            if (!existingVideo.is_song) {
                return NextResponse.json(
                    {
                        message:
                            "Video is registered as NOT a song. Listening time will not be tracked.",
                        isSong: Boolean(existingVideo.is_song),
                    },
                    { status: 400 },
                );
            }

            const sessionId = createListeningSession(videoId);
            return NextResponse.json({
                message: `Tracking listening time of ${existingVideo.title} 🎧`,
                sessionId,
                isSong: Boolean(existingVideo.is_song),
            });
        }

        const isSong = genre === "Music";
        const message = registerVideo(
            { title, channel, description, videoId, thumbnailUrl, genre },
            isSong,
        );
        const sessionId = isSong ? createListeningSession(videoId) : null;

        return NextResponse.json({
            message,
            sessionId,
            isSong,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 },
        );
    }
}

function registerVideo(
    details: {
        title: string;
        channel: string;
        description: string;
        videoId: string;
        thumbnailUrl?: string | null;
        genre?: string;
    },
    isSong: boolean,
) {
    sqliteDb
        .prepare(
            `INSERT INTO video (id, title, channel_id, legacy_channel_name, description, duration, is_song) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
            details.videoId,
            details.title,
            null,
            details.channel,
            details.description,
            0,
            isSong ? 1 : 0,
        );

    const message = `Registered ${details.title} as ${isSong ? "" : "NOT "}a song.`;

    if (isSong) {
        const unmappedArtistId = 98;
        sqliteDb
            .prepare(
                `INSERT INTO artist_song (video_id, artist_id, mapping_type) VALUES (?, ?, ?)`,
            )
            .run(details.videoId, unmappedArtistId, "unknown");
    }

    return message;
}

function createListeningSession(videoId: string) {
    const result = sqliteDb
        .prepare(
            "INSERT INTO listening_session (video_id, listening_time) VALUES (?, 0)",
        )
        .run(videoId);
    return result.lastInsertRowid;
}
