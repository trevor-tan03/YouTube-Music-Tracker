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

function getOrderByExpression(sortBy: string | null) {
    switch (sortBy) {
        case "recent":
            return sql`v.created_at DESC`;
        case "oldest":
            return sql`v.created_at ASC`;
        case "last-played":
            return sql`CASE WHEN v.is_song = 1 THEN IFNULL(MAX(ls.started_at), 0) ELSE v.created_at END DESC`;
        case "duration-desc":
            return sql`v.duration DESC`;
        case "duration-asc":
            return sql`v.duration ASC`;
        case "most-played":
            return sql`total_listening_time DESC`;
        default:
            return sql`CASE WHEN v.is_song = 1 THEN IFNULL(MAX(ls.started_at), 0) ELSE v.created_at END DESC`;
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const searchFilter = searchParams.get("search") || "";
    const classification = searchParams.get("classification");
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const offset = Number.parseInt(searchParams.get("offset") || "0", 10);
    const sortBy = searchParams.get("sortBy");
    const period = searchParams.get("period");
    const artistIdParam = searchParams.get("artistId");
    const artistId = artistIdParam ? Number.parseInt(artistIdParam, 10) : null;

    const hasArtistId = artistId !== null;
    const hasPeriodFilter = Boolean(period) && period !== "all";
    const periodCondition = getPeriodCondition(period);

    // ---- Total count (mirrors the GROUP BY / HAVING semantics of the raw query) ----
    const countRow = await db
        .selectFrom((eb) => {
            let sub = eb
                .selectFrom("video as v")
                .leftJoin("artist_video as ast", "ast.video_id", "v.id")
                .leftJoin("channel as c", "c.id", "v.channel_id")
                .leftJoin("listening_session as ls", (join) => {
                    let j = join.onRef("ls.video_id", "=", "v.id");
                    if (periodCondition) j = j.on(periodCondition);
                    return j;
                })
                .$if(Boolean(searchFilter), (qb) =>
                    qb.where((wb) =>
                        wb.or([
                            wb("v.title", "like", `%${searchFilter}%`),
                            wb("c.name", "like", `%${searchFilter}%`),
                        ]),
                    ),
                )
                .$if(hasArtistId, (qb) =>
                    qb.where("ast.artist_id", "=", artistId as number),
                )
                .$if(classification === "song", (qb) =>
                    qb.where("v.is_song", "=", 1),
                )
                .$if(classification === "video", (qb) =>
                    qb.where("v.is_song", "=", 0),
                )
                .$if(classification === "unknown", (qb) =>
                    qb.where("v.is_song", "is", null),
                )
                .select("v.id")
                .groupBy("v.id");

            if (hasPeriodFilter) {
                sub = sub.having(
                    sql<boolean>`IFNULL(SUM(ls.listening_time), 0) > 0`,
                );
            }

            return sub.as("sub");
        })
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst();

    const total = Number(countRow?.total ?? 0);

    // ---- Main video listing ----
    let videoQuery = db
        .selectFrom("video as v")
        .leftJoin("artist_video as ast", "ast.video_id", "v.id")
        .leftJoin("channel as c", "c.id", "v.channel_id")
        .leftJoin("listening_session as ls", (join) => {
            let j = join.onRef("ls.video_id", "=", "v.id");
            if (periodCondition) j = j.on(periodCondition);
            return j;
        })
        .$if(Boolean(searchFilter), (qb) =>
            qb.where((wb) =>
                wb.or([
                    wb("v.title", "like", `%${searchFilter}%`),
                    wb("c.name", "like", `%${searchFilter}%`),
                ]),
            ),
        )
        .$if(hasArtistId, (qb) =>
            qb.where("ast.artist_id", "=", artistId as number),
        )
        .$if(classification === "song", (qb) => qb.where("v.is_song", "=", 1))
        .$if(classification === "video", (qb) => qb.where("v.is_song", "=", 0))
        .$if(classification === "unknown", (qb) =>
            qb.where("v.is_song", "is", null),
        )
        .selectAll("v")
        .select("ast.artist_id")
        .select(
            sql<number>`IFNULL(SUM(ls.listening_time), 0)`.as(
                "total_listening_time",
            ),
        )
        .select(
            sql<number>`CASE WHEN v.duration > 0 THEN CAST(SUM(ls.listening_time) / v.duration AS FLOAT) ELSE 0 END`.as(
                "play_count",
            ),
        )
        .groupBy("v.id");

    if (hasPeriodFilter) {
        videoQuery = videoQuery.having(
            sql<boolean>`IFNULL(SUM(ls.listening_time), 0) > 0`,
        );
    }

    const videos = await videoQuery
        .orderBy(getOrderByExpression(sortBy))
        .limit(limit)
        .offset(offset)
        .execute();

    // ---- Stats (INNER JOIN listening_session, so only videos with sessions count) ----
    const stats = await db
        .selectFrom("video as v")
        .leftJoin("artist_video as ast", "ast.video_id", "v.id")
        .leftJoin("channel as c", "c.id", "v.channel_id")
        .innerJoin("listening_session as ls", (join) => {
            let j = join.onRef("ls.video_id", "=", "v.id");
            if (periodCondition) j = j.on(periodCondition);
            return j;
        })
        .$if(Boolean(searchFilter), (qb) =>
            qb.where((wb) =>
                wb.or([
                    wb("v.title", "like", `%${searchFilter}%`),
                    wb("c.name", "like", `%${searchFilter}%`),
                ]),
            ),
        )
        .$if(hasArtistId, (qb) =>
            qb.where("ast.artist_id", "=", artistId as number),
        )
        .$if(classification === "song", (qb) => qb.where("v.is_song", "=", 1))
        .$if(classification === "video", (qb) => qb.where("v.is_song", "=", 0))
        .$if(classification === "unknown", (qb) =>
            qb.where("v.is_song", "is", null),
        )
        .select((eb) =>
            eb.fn.count<number>("v.id").distinct().as("total_videos"),
        )
        .select(
            sql<number>`IFNULL(SUM(ls.listening_time), 0)`.as(
                "total_listening_time",
            ),
        )
        .executeTakeFirst();

    return NextResponse.json({
        videos,
        stats: {
            totalVideos: stats?.total_videos ?? 0,
            totalListeningTime: stats?.total_listening_time ?? 0,
        },
        pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
            nextOffset: offset + limit < total ? offset + limit : null,
        },
    });
}
