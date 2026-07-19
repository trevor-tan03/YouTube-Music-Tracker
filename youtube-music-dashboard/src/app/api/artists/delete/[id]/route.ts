import { db } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: number }> },
) {
    const { id } = await params;
    const artist = await db
        .selectFrom("artist")
        .select("artist.id")
        .where("artist.id", "=", id)
        .executeTakeFirstOrThrow();

    if (!artist) {
        return NextResponse.json(
            { error: "Artist not found" },
            { status: 404 },
        );
    }

    await db
        .deleteFrom("artist")
        .where("artist.id", "=", id)
        .executeTakeFirstOrThrow();

    return NextResponse.json({ message: "Artist deleted successfully" });
}
