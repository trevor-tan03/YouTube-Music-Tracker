import { type Request, type Response } from "express";
import { db } from "../database/database.js";
import { heuristicsCheck } from "../util/songHeuristic.js";

export async function analyseVideo(req: Request, res: Response) {
    const body: RequestBody = await req.body;

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

    const heuristicResult = await heuristicsCheck(
        body.title,
        body.channel,
        body.description,
        body.duration,
        body.genre,
    );
    if (heuristicResult.isSong && heuristicResult.confidence === "high") {
        // Handle the case where the video is classified as a song with high confidence
    }
}

interface RequestBody {
    title: string;
    channel: string;
    description: string;
    duration: number;
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
