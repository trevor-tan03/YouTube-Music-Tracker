import { db } from "@/src/lib/database/database";
import { sql } from "kysely";
import { NextResponse } from "next/server";

function getPeriodCondition(period: string | null) {
    switch (period) {
        case "day":
            return sql<boolean>`date(ls.started_at, 'unixepoch') = date('now')`;
        case "week":
            return sql<boolean>`strftime('%W-%Y', ls.started_at, 'unixepoch') = strftime('%W-%Y', 'now')`;
        case "month":
            return sql<boolean>`strftime('%m-%Y', ls.started_at, 'unixepoch') = strftime('%m-%Y', 'now')`;
        case "year":
            return sql<boolean>`strftime('%Y', ls.started_at, 'unixepoch') = strftime('%Y', 'now')`;
        default:
            return null;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const periodCondition = getPeriodCondition(period);

    const artists = await db
        .selectFrom("video as v")
        .innerJoin("artist_video as asg", "asg.video_id", "v.id")
        .innerJoin("artist as a", "a.id", "asg.artist_id")
        .innerJoin("listening_session as ls", "ls.video_id", "v.id")
        .$if(periodCondition !== null, (qb) => qb.where(() => periodCondition!))
        .select("a.id as artist_id")
        .select("a.name as artist_name")
        .select((eb) => eb.fn.count<number>("v.id").distinct().as("song_count"))
        .select(
            sql<number>`SUM(ls.listening_time) / 3600.0`.as(
                "total_listening_time",
            ),
        )
        .groupBy(["a.id", "a.name"])
        .having(sql<boolean>`SUM(ls.listening_time) > 0`)
        .orderBy(sql`SUM(ls.listening_time)`, "desc")
        .execute();

    return NextResponse.json(artists);
}
