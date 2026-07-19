import { db } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const artistId = searchParams.get("artistId");

    if (!artistId) {
        return NextResponse.json(
            { error: "artistId query param is required" },
            { status: 400 },
        );
    }

    const artist = await db
        .selectFrom("artist")
        .select("id")
        .where("artist.id", "=", Number(artistId))
        .executeTakeFirst();

    if (!artist) {
        return NextResponse.json(
            { error: "No artist found with the specified id" },
            { status: 404 },
        );
    }

    const aliases = await db
        .selectFrom("artist_alias")
        .selectAll()
        .where("artist_id", "=", artist.id)
        .execute();

    return NextResponse.json(aliases);
}

export async function POST(request: Request) {
    try {
        const { artistId, aliases } = await request.json();

        if (!artistId || typeof artistId !== "number") {
            return NextResponse.json(
                { error: "artistId is required" },
                { status: 400 },
            );
        }

        if (!Array.isArray(aliases) || aliases.length === 0) {
            return NextResponse.json(
                { error: "aliases must be a non-empty array" },
                { status: 400 },
            );
        }

        // trim, drop empties, dedupe
        const cleanAliases = [
            ...new Set(
                aliases
                    .map((a) => (typeof a === "string" ? a.trim() : ""))
                    .filter((a) => a.length > 0),
            ),
        ];

        if (cleanAliases.length === 0) {
            return NextResponse.json(
                { error: "No valid aliases provided" },
                { status: 400 },
            );
        }

        const artist = await db
            .selectFrom("artist")
            .select("id")
            .where("id", "=", artistId)
            .executeTakeFirst();

        if (!artist) {
            return NextResponse.json(
                { error: `Artist id ${artistId} does not exist` },
                { status: 400 },
            );
        }

        // skip aliases already registered for this artist
        const existing = await db
            .selectFrom("artist_alias")
            .select("alias")
            .where("artist_id", "=", artistId)
            .where("alias", "in", cleanAliases)
            .execute();

        const existingSet = new Set(existing.map((e) => e.alias));
        const toInsert = cleanAliases.filter((a) => !existingSet.has(a));

        if (toInsert.length === 0) {
            return NextResponse.json(
                { error: "All provided aliases already exist for this artist" },
                { status: 400 },
            );
        }

        await db
            .insertInto("artist_alias")
            .values(toInsert.map((alias) => ({ artist_id: artistId, alias })))
            .execute();

        return NextResponse.json({ artistId, inserted: toInsert });
    } catch {
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 },
        );
    }
}
