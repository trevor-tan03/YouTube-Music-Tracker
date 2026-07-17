import { heuristicsCheck } from "@/src/lib/classification/songHeuristic";
import { db } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

interface RequestBody {
    title: string;
    channel: string;
    description: string;
    duration: number;
    videoId: string;
    genre: string;
    avatar: string;
}

export async function POST(req: Request) {
    const body: RequestBody = await req.json();

    if (!body.title || !body.channel || !body.description || !body.videoId) {
        return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 },
        );
    }

    const existingVideo = await db
        .selectFrom("video")
        .selectAll()
        .where("video.id", "=", body.videoId)
        .executeTakeFirst();

    if (existingVideo) {
        if (!existingVideo.is_song) {
            return NextResponse.json(
                {
                    message:
                        "Video is registered as NOT a song. Listening time will not be tracked.",
                    isSong: false,
                },
                { status: 400 },
            );
        }

        const session = await createListeningSession(body.videoId);
        return NextResponse.json({
            message: `Tracking listening time of ${existingVideo.title} 🎧`,
            isSong: true,
            sessionId: session.id,
        });
    }

    const heuristicResult = await heuristicsCheck(
        body.title,
        body.channel,
        body.description,
        body.duration,
        body.genre,
    );

    if (heuristicResult.confidence === "high") {
        const { video } = await registerVideo(
            {
                videoId: body.videoId,
                title: body.title,
                channelName: body.channel,
                channelAvatar: body.avatar,
                description: body.description,
                duration: body.duration,
                isSong: heuristicResult.isSong ? 1 : 0,
            },
            "heuristic",
        );

        return NextResponse.json({
            message: heuristicResult.isSong
                ? "Video registered as a song."
                : "Video registered as NOT a song.",
            isSong: heuristicResult.isSong,
            videoId: video.id,
        });
    }

    // Low-confidence heuristic — no LLM fallback wired up yet
    return NextResponse.json(
        { message: "Could not confidently classify video.", isSong: null },
        { status: 202 },
    );
}

interface VideoDetails {
    videoId: string;
    title: string;
    channelName: string;
    channelAvatar: string;
    description: string | null;
    duration: number;
    isSong: 0 | 1;
}

async function registerVideo(
    videoDetails: VideoDetails,
    type: "manual" | "heuristic" | "llm" | "unknown",
) {
    let channel = await db
        .selectFrom("channel")
        .select("channel.id")
        .where("channel.name", "=", videoDetails.channelName)
        .executeTakeFirst();

    if (!channel) {
        channel = await db
            .insertInto("channel")
            .values({
                name: videoDetails.channelName,
                avatar: videoDetails.channelAvatar,
            })
            .returning("id")
            .executeTakeFirstOrThrow();
    }

    const video = await db
        .insertInto("video")
        .values({
            id: videoDetails.videoId,
            title: videoDetails.title,
            channel_id: channel.id,
            duration: videoDetails.duration,
            is_song: videoDetails.isSong,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    const classification = await db
        .insertInto("video_song_classification_history")
        .values({
            video_id: video.id,
            is_song: video.is_song,
            type,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    return { video, classification };
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
