import { heuristicsCheck } from "@/src/lib/classification/songHeuristic";
import { db } from "@/src/lib/database/database";
import { NextResponse } from "next/server";
import { exec } from "node:child_process";

interface RequestBody {
    title: string;
    channel: string;
    description: string;
    duration: number;
    videoId: string;
    genre: string;
}

interface VideoDetails {
    videoId: string;
    title: string;
    channelName: string;
    description: string | null;
    duration: number;
    isSong: 0 | 1;
}

const UNMAPPED_ARTIST_ID = 1900; // TODO: move to config/env

/*
    When a video is clicked, a request will be made to this endpoint to see if it's an existing video or not.
    If it's new, we need to determine whether the video is a song or not.
    Also create a row to the channel table if the channel hasn't been seen before
*/
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
        .executeTakeFirstOrThrow();

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

    const videoDetails: VideoDetails = {
        videoId: body.videoId,
        title: body.title,
        channelName: body.channel,
        description: body.description,
        duration: body.duration,
        isSong: heuristicResult.isSong ? 1 : 0,
    };

    // Register the video first
    const { video, artistMapping } = await registerVideo(
        videoDetails,
        heuristicResult.confidence === "high" ? "heuristic" : "llm",
    );

    // ALWAYS create a listening session if it's a song
    if (video.is_song) {
        const session = await createListeningSession(video.id);
        return NextResponse.json({
            message: heuristicResult.isSong
                ? `Video registered as a song. Tracking listening time 🎧`
                : "Video registered as NOT a song.",
            isSong: true,
            videoId: video.id,
            sessionId: session.id,
            artistId: artistMapping?.artistId ?? null,
            artistMappingType: artistMapping?.mappingType ?? null,
        });
    }

    // Not a song - no session
    return NextResponse.json({
        message:
            "Video registered as NOT a song. Listening time will not be tracked.",
        isSong: false,
        videoId: video.id,
    });
}

async function findMatchingArtist(
    channelId: number,
    title: string,
): Promise<{ artistId: number; mappingType: "heuristic" } | null> {
    // Strongest signal: the video was posted on the artist's own channel
    const channelMatch = await db
        .selectFrom("artist")
        .select("id")
        .where("channel_id", "=", channelId)
        .executeTakeFirst();

    if (channelMatch) {
        return { artistId: channelMatch.id, mappingType: "heuristic" };
    }

    // Fallback: does the title mention an artist by name or a known alias?
    const [artists, aliases] = await Promise.all([
        db.selectFrom("artist").select(["id", "name"]).execute(),
        db.selectFrom("artist_alias").select(["artist_id", "alias"]).execute(),
    ]);

    const normalizedTitle = title.toLowerCase();

    const matchedArtistIds = new Set<number>();

    for (const artist of artists) {
        if (normalizedTitle.includes(artist.name.toLowerCase())) {
            matchedArtistIds.add(artist.id);
        }
    }
    for (const alias of aliases) {
        if (normalizedTitle.includes(alias.alias.toLowerCase())) {
            matchedArtistIds.add(alias.artist_id);
        }
    }

    // Only trust this if exactly one artist matched — an ambiguous
    // match is worse than leaving the video unmapped
    if (matchedArtistIds.size === 1) {
        return {
            artistId: [...matchedArtistIds][0],
            mappingType: "heuristic",
        };
    }

    return null;
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
        exec(`yt-dlp `);

        channel = await db
            .insertInto("channel")
            .values({
                name: videoDetails.channelName,
                // avatar: videoDetails.channelAvatar,
            })
            .returning("id")
            .executeTakeFirstOrThrow();
    }

    const video = await db
        .insertInto("video")
        .values({
            id: videoDetails.videoId,
            title: videoDetails.title,
            description: videoDetails.description,
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

    let artistMapping: { artistId: number; mappingType: string } | null = null;

    if (videoDetails.isSong) {
        const match = await findMatchingArtist(channel.id, videoDetails.title);
        const artistId = match?.artistId ?? UNMAPPED_ARTIST_ID;
        const mappingType = match?.mappingType ?? "unknown";

        await db
            .insertInto("artist_video")
            .values({
                video_id: video.id,
                artist_id: artistId,
                mapping_type: mappingType,
            })
            .execute();

        artistMapping = { artistId, mappingType };

        if (match) {
            console.log(
                `Mapped video "${video.title}" to artist ID ${artistId} (${mappingType})`,
            );
        }
    }

    return { video, classification, artistMapping };
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
