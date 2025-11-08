import { db } from "../database/database.js";

/*
period: "day", "week", "month", "year", "all"
return: listening time in seconds

if period is "day", return the listening time for the current day
if period is "week", return the listening time for the current week
if period is "month", return the listening time for the current month
if period is "year", return the listening time for the current year
if period is "all", return the listening time for all time
if period is not provided, return the listening time for the current day
*/
export async function getTopListensInPeriod(period) {
	let query = `
	SELECT 
		v.id as video_id,
		v.title,
		v.channel,
		v.duration,
		v.thumbnail_url,
        v.is_song,
		SUM(ls.listening_time) as total_listening_time
	FROM listening_session ls
	JOIN video v ON ls.video_id = v.id
	WHERE 1=1 AND v.is_song = 1
`;

	switch (period) {
		case "day":
			query += ` AND date(ls.started_at, 'unixepoch') = date('now')`;
			break;

		case "week":
			query += `
			AND strftime('%W-%Y', ls.started_at, 'unixepoch') = strftime('%W-%Y', 'now')
		`;
			break;

		case "month":
			query += `
			AND strftime('%m-%Y', ls.started_at, 'unixepoch') = strftime('%m-%Y', 'now')
		`;
			break;

		case "year":
			query += `
			AND strftime('%Y', ls.started_at, 'unixepoch') = strftime('%Y', 'now')
		`;
			break;

		case "all":
		default:
			// no time filter
			break;
	}

	query += `
	GROUP BY v.id
	ORDER BY total_listening_time DESC
	LIMIT 10
`;

	const rows = db.prepare(query).all();
	return rows;
}
