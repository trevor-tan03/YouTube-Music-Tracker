import { sqliteDb } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const artist = sqliteDb
        .prepare(`SELECT * FROM artist WHERE id = ?`)
        .get(id);

    if (!artist) {
        return NextResponse.json(
            { error: "Artist not found" },
            { status: 404 },
        );
    }

    sqliteDb.prepare(`DELETE FROM artist WHERE id = ?`).run(id);

    return NextResponse.json({ message: "Artist deleted successfully" });
}
