import { sqliteDb } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "day";

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

    const result = sqliteDb
        .prepare(
            `SELECT
                v.id,
                v.title,
                COALESCE(SUM(ls.listening_time), 0) AS total_listening_time
            FROM video v
            LEFT JOIN listening_session ls ON ls.video_id = v.id ${periodFilter ? `WHERE 1=1 ${periodFilter}` : ""}
            GROUP BY v.id, v.title
            ORDER BY total_listening_time DESC
            LIMIT 10`,
        )
        .all();

    return NextResponse.json(result);
}
