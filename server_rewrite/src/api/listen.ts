import type { Request, Response } from "express";
import { db } from "../database/database.js";

interface RequestBody {
    sessionId: number;
    listeningTime: number;
}

export async function addSongListeningTime(req: Request, res: Response) {
    const body: RequestBody = await req.body;

    if (!body.sessionId || !body.listeningTime) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    if (typeof body.listeningTime !== "number" || body.listeningTime <= 0) {
        return res.status(400).json({ error: "Invalid listening time" });
    }

    if (typeof body.sessionId !== "number" || body.sessionId <= 0) {
        return res.status(400).json({ error: "Invalid session ID" });
    }

    const session = await db
        .selectFrom("listening_session")
        .select(["id", "video_id", "listening_time"])
        .where("id", "=", body.sessionId)
        .executeTakeFirst();

    if (!session) {
        return res.status(404).json({ error: "Listening session not found" });
    }

    await db
        .updateTable("listening_session")
        .set({
            listening_time: session.listening_time + body.listeningTime,
        })
        .where("id", "=", body.sessionId)
        .execute();

    const video = await db
        .selectFrom("video")
        .select("title")
        .where("id", "=", session.video_id)
        .executeTakeFirst();

    console.log(
        `${video?.title} - session ${session.id} - listened for ${session.listening_time + body.listeningTime} seconds.`,
    );

    return res
        .status(200)
        .json({ message: "Listening time updated successfully" });
}
