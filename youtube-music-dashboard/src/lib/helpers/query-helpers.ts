import { sql } from "kysely";

export function getPeriodCondition(period: string | null) {
    switch (period) {
        case "day":
            return sql<boolean>`date(ls.started_at) = date('now')`;
        case "week":
            return sql<boolean>`strftime('%W-%Y', ls.started_at) = strftime('%W-%Y', 'now')`;
        case "month":
            return sql<boolean>`strftime('%m-%Y', ls.started_at) = strftime('%m-%Y', 'now')`;
        case "year":
            return sql<boolean>`strftime('%Y', ls.started_at) = strftime('%Y', 'now')`;
        default:
            return null;
    }
}

export function getOrderByExpression(sortBy: string | null) {
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
