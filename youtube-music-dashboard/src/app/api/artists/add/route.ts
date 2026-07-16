import { sqliteDb } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const { name } = await request.json();

        if (!name) {
            return NextResponse.json(
                { error: "Artist name is required" },
                { status: 400 },
            );
        }

        if (sqliteDb.prepare(`SELECT 1 FROM artist WHERE name = ?`).get(name)) {
            return NextResponse.json(
                { error: "Artist already exists" },
                { status: 400 },
            );
        }

        const result = sqliteDb
            .prepare(`INSERT INTO artist (name) VALUES (?)`)
            .run(name);
        const newArtist = sqliteDb
            .prepare(`SELECT * FROM artist WHERE id = ?`)
            .get(result.lastInsertRowid);

        return NextResponse.json(newArtist);
    } catch {
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 },
        );
    }
}
