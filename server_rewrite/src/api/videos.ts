import type { Request, Response } from "express";
import { sql } from "kysely";
import { db } from "../database/database.js";

interface QueryParams {
    search?: string;
    classification?: "song" | "video";
    limit?: string;
    offset?: string;
    sortBy?: "last-played" | "most-played";
    period?: "day" | "week" | "month" | "year" | "all";
    artistId?: number;
}

function getPeriodCondition(period?: string) {
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

const lastPlayedExpr = sql`CASE WHEN v.is_song = 1 THEN IFNULL(MAX(ls.started_at), 0) ELSE v.created_at END`;

function getOrderBy(sortBy?: string) {
    return sortBy === "most-played"
        ? sql`total_listening_time DESC`
        : sql`${lastPlayedExpr} DESC`; // default: last-played
}

function buildBaseQuery(params: {
    search: string | undefined;
    classification: string | undefined;
    period: string | undefined;
    artistId: number | undefined;
}) {
    const { search, classification, period, artistId } = params;
    const periodCondition = getPeriodCondition(period);

    return db
        .selectFrom("video as v")
        .leftJoin("artist_song as ast", "ast.video_id", "v.id")
        .leftJoin("listening_session as ls", (join) => {
            let j = join.onRef("ls.video_id", "=", "v.id");
            if (periodCondition) j = j.on(periodCondition);
            return j;
        })
        .$if(!!search, (qb) =>
            qb.where((eb) =>
                eb.or([
                    eb("v.title", "like", `%${search}%`),
                    eb("v.channel", "like", `%${search}%`),
                ]),
            ),
        )
        .$if(!!artistId, (qb) => qb.where("ast.artist_id", "=", artistId!))
        .$if(classification === "song", (qb) => qb.where("v.is_song", "=", 1))
        .$if(classification === "video", (qb) => qb.where("v.is_song", "=", 0))
        .groupBy("v.id");
}

export async function getVideos(req: Request, res: Response) {
    try {
        const {
            search,
            classification,
            limit: limitStr,
            offset: offsetStr,
            sortBy,
            period,
            artistId,
        } = req.query as QueryParams;

        const limit = parseInt(limitStr ?? "50") || 50;
        const offset = parseInt(offsetStr ?? "0") || 0;
        const applyHaving = !!period && period !== "all";
        const baseQueryParams = { search, classification, period, artistId };

        // ---------------------------------------------------------
        // COUNT QUERY
        // ---------------------------------------------------------
        const { total } = await db
            .selectFrom(
                buildBaseQuery(baseQueryParams)
                    .$if(applyHaving, (qb) =>
                        qb.having(
                            sql`IFNULL(SUM(ls.listening_time), 0)`,
                            ">",
                            0,
                        ),
                    )
                    .select("v.id")
                    .as("subq"),
            )
            .select(({ fn }) => fn.countAll<number>().as("total"))
            .executeTakeFirstOrThrow();

        // ---------------------------------------------------------
        // MAIN QUERY
        // ---------------------------------------------------------
        const videos = await buildBaseQuery(baseQueryParams)
            .selectAll("v")
            .select([
                sql<number>`IFNULL(SUM(ls.listening_time), 0)`.as(
                    "total_listening_time",
                ),
                sql<number>`CASE WHEN v.duration > 0 THEN CAST(SUM(ls.listening_time) / v.duration AS FLOAT) ELSE 0 END`.as(
                    "play_count",
                ),
            ])
            .$if(applyHaving, (qb) =>
                qb.having(sql`IFNULL(SUM(ls.listening_time), 0)`, ">", 0),
            )
            .orderBy(getOrderBy(sortBy))
            .limit(limit)
            .offset(offset)
            .execute();

        // ---------------------------------------------------------
        // STATS QUERY
        // ---------------------------------------------------------
        const periodCondition = getPeriodCondition(period);
        const stats = await db
            .selectFrom("video as v")
            .leftJoin("artist_song as ast", "ast.video_id", "v.id")
            .innerJoin("listening_session as ls", (join) => {
                let j = join.onRef("ls.video_id", "=", "v.id");
                if (periodCondition) j = j.on(periodCondition);
                return j;
            })
            .$if(!!search, (qb) =>
                qb.where((eb) =>
                    eb.or([
                        eb("v.title", "like", `%${search}%`),
                        eb("v.channel", "like", `%${search}%`),
                    ]),
                ),
            )
            .$if(!!artistId, (qb) => qb.where("ast.artist_id", "=", artistId!))
            .$if(classification === "song", (qb) =>
                qb.where("v.is_song", "=", 1),
            )
            .$if(classification === "video", (qb) =>
                qb.where("v.is_song", "=", 0),
            )
            .select([
                sql<number>`COUNT(DISTINCT v.id)`.as("total_videos"),
                sql<number>`IFNULL(SUM(ls.listening_time), 0)`.as(
                    "total_listening_time",
                ),
            ])
            .executeTakeFirstOrThrow();

        return res.status(200).json({
            videos,
            stats: {
                totalVideos: stats.total_videos ?? 0,
                totalListeningTime: stats.total_listening_time ?? 0,
            },
            pagination: {
                total: Number(total),
                limit,
                offset,
                hasMore: offset + limit < Number(total),
                nextOffset:
                    offset + limit < Number(total) ? offset + limit : null,
            },
        });
    } catch (error) {
        console.error("Error fetching videos:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}
