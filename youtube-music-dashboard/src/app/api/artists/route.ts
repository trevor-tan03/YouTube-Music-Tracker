import { db } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function GET() {
    const artists = await db
        .selectFrom("artist")
        .fullJoin("channel", "artist.channel_id", "channel.id")
        .select([
            "artist.id",
            "artist.name",
            "artist.channel_id",
            "channel.name",
            "channel.avatar",
        ])
        .orderBy((eb) => eb.fn("lower", ["artist.name"]), "asc")
        .executeTakeFirstOrThrow();

    return NextResponse.json(artists);
}

export async function POST(request: Request) {
    try {
        const { name, channelId } = await request.json();

        if (!name) {
            return NextResponse.json(
                { error: "Artist name is required" },
                { status: 400 },
            );
        }

        const artist = await db
            .selectFrom("artist")
            .select("artist.name")
            .where("artist.name", "=", name)
            .executeTakeFirstOrThrow();

        if (artist) {
            return NextResponse.json(
                { error: "Artist already exists" },
                { status: 400 },
            );
        }

        const channel = await db
            .selectFrom("channel")
            .select("channel.id")
            .where("channel.name", "=", channelId)
            .executeTakeFirstOrThrow();

        if (!channel) {
            return NextResponse.json(
                { error: `Channel Id: ${channelId} does not exist` },
                { status: 400 },
            );
        }

        const newArtist = await db
            .insertInto("artist")
            .values({
                name: name,
                channel_id: channelId,
            })
            .returning(["artist.id", "artist.name", "artist.channel_id"])
            .executeTakeFirstOrThrow();

        return NextResponse.json(newArtist);
    } catch {
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 },
        );
    }
}
