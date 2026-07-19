import { db } from "@/src/lib/database/database";
import { getPeriodCondition } from "@/src/lib/helpers/query-helpers";
import { sql } from "kysely";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all";
    const periodCondition = getPeriodCondition(period);

    let query = db
        .selectFrom("video as v")
        .leftJoin("listening_session as ls", "ls.video_id", "v.id")
        .select(["v.id", "v.title"])
        .select(
            sql<number>`COALESCE(SUM(ls.listening_time), 0)`.as(
                "total_listening_time",
            ),
        )
        .groupBy(["v.id", "v.title"])
        .orderBy("total_listening_time", "desc")
        .limit(10);

    if (periodCondition) {
        query = query.where(periodCondition);
    }

    const result = await query.execute();

    return NextResponse.json(result);
}
