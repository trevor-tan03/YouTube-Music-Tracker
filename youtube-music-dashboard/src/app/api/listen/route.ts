import { db } from "@/src/lib/database/database";
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
        const session = await db
            .selectFrom("listening_session")
            .select(["id", "video_id", "listening_time"])
            .where("id", "=", sessionId)
            .executeTakeFirstOrThrow();

        if (!session) {
            return NextResponse.json(
                { error: "Listening session not found" },
                { status: 404 },
            );
        }

        await db
            .updateTable("listening_session")
            .set({
                listening_time: sessionListeningTime,
            })
            .where("listening_session.id", "=", sessionId)
            .executeTakeFirstOrThrow();

        const video = await db
            .selectFrom("video")
            .select([
                "id",
                "title",
                "channel_id",
                "description",
                "duration",
                "is_song",
                "created_at",
            ])
            .where("id", "=", session.video_id)
            .executeTakeFirstOrThrow();

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
