import type { Request, Response } from "express";
import { db } from "../database/database.js";

interface RequestBody {
    videoId: string;
    isSong: boolean;
}

export async function classifySong(req: Request, res: Response) {
    const body: RequestBody = req.body;

    if (typeof body.videoId !== "string" || typeof body.isSong !== "boolean") {
        return res.status(400).json({ error: "Invalid request body" });
    }

    const existingVideo = await db
        .selectFrom("video")
        .select(["id", "title"])
        .where("id", "=", body.videoId)
        .executeTakeFirst();

    if (!existingVideo) {
        return res
            .status(404)
            .json({ error: "Video with specified id does not exist" });
    }

    await db
        .updateTable("video")
        .set({ is_song: body.isSong ? 1 : 0 })
        .where("id", "=", body.videoId)
        .execute();

    console.log(
        `${existingVideo.title} (${body.videoId}) updated to`,
        body.isSong ? "song" : "not song",
    );
    return res.status(200).json({
        message: `Video classified as ${body.isSong ? "song" : "not song"}`,
        isSong: body.isSong,
    });
}
