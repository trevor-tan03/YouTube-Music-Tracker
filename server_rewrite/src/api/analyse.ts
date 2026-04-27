import { type Request, type Response } from "express";
import OpenAI from "openai";
import { db } from "../database/database.js";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function analyseVideo(request: Request, res: Response) {
    const body: RequestBody = await request.body;

    if (!body.title || !body.channel || !body.description || !body.videoId) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    let message = "";
    const existingVideo = await db
        .selectFrom("video")
        .selectAll()
        .where("video.id", "=", body.videoId)
        .executeTakeFirst();

    if (existingVideo) {
        if (!existingVideo.is_song) {
            message =
                "Video is registered as NOT a song. Listening time will not be tracked.";
            console.log(message);
            return res.status(400).json({
                message,
                isSong: Boolean(existingVideo.is_song),
            });
        }

        const sessionId = await createListeningSession(body.videoId);
        message = `Tracking listening time of ${existingVideo} 🎧`;
        console.log(message);
        return res.status(200).json({
            message,
            isSong: Boolean(existingVideo.is_song),
            sessionId,
        });
    }
}

interface RequestBody {
    title: string;
    channel: string;
    description: string;
    videoId: string;
    genre: string;
}

async function createListeningSession(videoId: string) {
    return await db
        .insertInto("listening_session")
        .values({
            video_id: videoId,
            listening_time: 0,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
}
