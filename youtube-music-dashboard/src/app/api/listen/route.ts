import { sqliteDb } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { sessionId, listeningTime } = await request.json();

        if (!sessionId || !listeningTime) {
            return NextResponse.json(
                {
                    error: "Missing required fields: sessionId, listeningTime",
                },
                { status: 400 },
            );
        }

        if (isNaN(Number.parseInt(listeningTime))) {
            return NextResponse.json(
                { error: "listeningTime must be a number" },
                { status: 400 },
            );
        }

        const sessionListeningTime = Number.parseInt(listeningTime);
        const session = sqliteDb
            .prepare(`SELECT * FROM listening_session WHERE id = ?`)
            .get(sessionId) as
            | { id: number; video_id: string; listening_time: number }
            | undefined;

        if (!session) {
            return NextResponse.json(
                { error: "Listening session not found" },
                { status: 404 },
            );
        }

        sqliteDb
            .prepare(
                "UPDATE listening_session SET listening_time = ? WHERE id = ?",
            )
            .run(sessionListeningTime, sessionId);

        const video = sqliteDb
            .prepare(`SELECT * FROM video WHERE id = ?`)
            .get(session.video_id) as { title: string } | undefined;

        const message = `${video?.title ?? "Unknown video"} - ${Math.floor(sessionListeningTime / 60)} mins total`;

        return NextResponse.json({ message });
    } catch (error) {
        return NextResponse.json(
            {
                error: `Failed to add listening time to song. ${error}`,
            },
            { status: 500 },
        );
    }
}
