import { sqliteDb } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");

    let periodFilter = "";
    switch (period) {
        case "day":
            periodFilter = `AND date(ls.started_at, 'unixepoch') = date('now')`;
            break;
        case "week":
            periodFilter = `AND strftime('%W-%Y', ls.started_at, 'unixepoch') = strftime('%W-%Y', 'now')`;
            break;
        case "month":
            periodFilter = `AND strftime('%m-%Y', ls.started_at, 'unixepoch') = strftime('%m-%Y', 'now')`;
            break;
        case "year":
            periodFilter = `AND strftime('%Y', ls.started_at, 'unixepoch') = strftime('%Y', 'now')`;
            break;
        default:
            break;
    }

    const artists = sqliteDb
        .prepare(
            `SELECT 
                a.id AS artist_id,
                a.name AS artist_name,
                COUNT(DISTINCT v.id) AS song_count,
                SUM(ls.listening_time) / 3600.0 AS total_listening_time
            FROM video v
            JOIN artist_song asg ON v.id = asg.video_id
            JOIN artist a ON asg.artist_id = a.id
            JOIN listening_session ls ON v.id = ls.video_id
            WHERE 1=1 ${periodFilter}
            GROUP BY a.id, a.name
            HAVING SUM(ls.listening_time) > 0
            ORDER BY SUM(ls.listening_time) DESC`,
        )
        .all();

    return NextResponse.json(artists);
}
