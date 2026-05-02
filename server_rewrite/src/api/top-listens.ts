import type { Request, Response } from "express";
import { sql, type SqlBool } from "kysely";
import { db } from "../database/database.js";

type Period = "day" | "week" | "month" | "year" | "all";

const VALID_PERIODS: Period[] = ["day", "week", "month", "year", "all"];

interface RequestBody {
    period: Period;
}

export async function getTopListens(
    req: Request<{}, {}, RequestBody>,
    res: Response,
) {
    const { period } = req.body;

    if (!period) {
        return res
            .status(400)
            .json({ error: "Missing 'period' in request body" });
    }

    if (!VALID_PERIODS.includes(period)) {
        return res.status(400).json({
            error: `Invalid 'period' value. Must be one of: ${VALID_PERIODS.join(", ")}`,
        });
    }

    try {
        const rows = await getTopListensInPeriod(period);
        return res.status(200).json(rows);
    } catch (error) {
        console.error("Failed to fetch top listens:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export async function getTopListensInPeriod(period: Period) {
    const baseQuery = db
        .selectFrom("listening_session as ls")
        .innerJoin("video as v", "ls.video_id", "v.id")
        .leftJoin("artist_song as ast", "v.id", "ast.video_id")
        .select([
            "v.id as video_id",
            "v.title",
            "v.channel",
            "v.duration",
            "v.is_song",
            "ast.artist_id",
            sql<number>`SUM(ls.listening_time)`.as("total_listening_time"),
        ])
        .where("v.is_song", "=", 1)
        .groupBy("v.id")
        .orderBy("total_listening_time", "desc")
        .limit(10);

    switch (period) {
        case "day":
            return baseQuery
                .where(
                    sql<SqlBool>`date(ls.started_at, 'unixepoch') = date('now')`,
                )
                .execute();
        case "week":
            return baseQuery
                .where(
                    sql<SqlBool>`strftime('%W-%Y', ls.started_at, 'unixepoch') = strftime('%W-%Y', 'now')`,
                )
                .execute();
        case "month":
            return baseQuery
                .where(
                    sql<SqlBool>`ls.started_at >= unixepoch('now', '-28 days')`,
                )
                .execute();
        case "year":
            return baseQuery
                .where(
                    sql<SqlBool>`strftime('%Y', ls.started_at, 'unixepoch') = strftime('%Y', 'now')`,
                )
                .execute();
        case "all":
            return baseQuery.execute();
        default:
            throw new Error(`Unhandled period: ${period}`);
    }
}
