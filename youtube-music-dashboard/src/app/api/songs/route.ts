import { sqliteDb } from "@/src/lib/database/database";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const searchFilter = searchParams.get("search") || "";
    const classification = searchParams.get("classification");
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const offset = Number.parseInt(searchParams.get("offset") || "0", 10);
    const sortBy = searchParams.get("sortBy");
    const period = searchParams.get("period");
    const artistId = searchParams.get("artistId") || null;

    const whereConditions: string[] = [];
    const params: unknown[] = [];

    if (searchFilter) {
        whereConditions.push(
            "(v.title LIKE ? OR v.legacy_channel_name LIKE ?)",
        );
        params.push(`%${searchFilter}%`, `%${searchFilter}%`);
    }

    if (artistId) {
        whereConditions.push("ast.artist_id = ?");
        params.push(artistId);
    }

    const artistJoin = artistId
        ? "INNER JOIN artist_song ast ON ast.video_id = v.id"
        : "LEFT JOIN artist_song ast ON ast.video_id = v.id";

    if (classification === "song") {
        whereConditions.push("v.is_song = 1");
    } else if (classification === "video") {
        whereConditions.push("v.is_song = 0");
    } else if (classification === "unknown") {
        whereConditions.push("v.is_song IS NULL");
    }

    const whereClause =
        whereConditions.length > 0
            ? `WHERE ${whereConditions.join(" AND ")}`
            : "";

    let periodFilter = "";
    let havingClause = "";

    if (period) {
        switch (period) {
            case "day":
                periodFilter = ` AND date(ls.started_at, 'unixepoch') = date('now')`;
                break;
            case "week":
                periodFilter = ` AND strftime('%W-%Y', ls.started_at, 'unixepoch') = strftime('%W-%Y', 'now')`;
                break;
            case "month":
                periodFilter = ` AND strftime('%m-%Y', ls.started_at, 'unixepoch') = strftime('%m-%Y', 'now')`;
                break;
            case "year":
                periodFilter = ` AND strftime('%Y', ls.started_at, 'unixepoch') = strftime('%Y', 'now')`;
                break;
            case "all":
            default:
                break;
        }

        if (period && period !== "all") {
            havingClause = "HAVING IFNULL(SUM(ls.listening_time), 0) > 0";
        }
    }

    let orderBy: string;

    switch (sortBy) {
        case "recent":
            orderBy = "v.created_at DESC";
            break;
        case "oldest":
            orderBy = "v.created_at ASC";
            break;
        case "last-played":
            orderBy = `CASE WHEN v.is_song = 1 THEN IFNULL(MAX(ls.started_at), 0) ELSE v.created_at END DESC`;
            break;
        case "duration-desc":
            orderBy = "v.duration DESC";
            break;
        case "duration-asc":
            orderBy = "v.duration ASC";
            break;
        case "most-played":
            orderBy = "total_listening_time DESC";
            break;
        default:
            orderBy = `CASE WHEN v.is_song = 1 THEN IFNULL(MAX(ls.started_at), 0) ELSE v.created_at END DESC`;
    }

    const countQuery = `
        SELECT COUNT(*) as total
        FROM (
            SELECT v.id
            FROM video v
            ${artistJoin}
            LEFT JOIN listening_session ls ON ls.video_id = v.id${periodFilter}
            ${whereClause}
            GROUP BY v.id
            ${havingClause}
        )
    `;
    const totalResult = sqliteDb.prepare(countQuery).get(params) as
        | { total: number }
        | undefined;
    const total = totalResult?.total ?? 0;

    const query = `
        SELECT
            v.*, 
            ast.artist_id,
            IFNULL(SUM(ls.listening_time), 0) AS total_listening_time,
            CASE
                WHEN v.duration > 0 THEN CAST(SUM(ls.listening_time) / v.duration AS FLOAT)
                ELSE 0
            END AS play_count
        FROM video v
        ${artistJoin}
        LEFT JOIN listening_session ls ON ls.video_id = v.id${periodFilter}
        ${whereClause}
        GROUP BY v.id
        ${havingClause}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
    `;
    const videos = sqliteDb.prepare(query).all([...params, limit, offset]);

    const statsQuery = `
        SELECT
            COUNT(DISTINCT v.id) AS total_videos,
            IFNULL(SUM(ls.listening_time), 0) AS total_listening_time
        FROM video v
        ${artistJoin}
        INNER JOIN listening_session ls ON ls.video_id = v.id${periodFilter}
        ${whereClause}
    `;
    const stats = sqliteDb.prepare(statsQuery).get(params) as {
        total_videos: number;
        total_listening_time: number;
    };

    return NextResponse.json({
        videos,
        stats: {
            totalVideos: stats.total_videos || 0,
            totalListeningTime: stats.total_listening_time || 0,
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
