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
async function getListeningTime(videoId, period) {
	let query = `
		SELECT SUM(listening_time) as total
		FROM listening_session
		WHERE video_id = ?
	`;

	switch (period) {
		case "day":
			query += ` AND date(started_at, 'unixepoch') = date('now')`;
			break;

		case "week":
			query += `
                    AND strftime('%W', started_at, 'unixepoch') = strftime('%W', 'now')
                    AND strftime('%Y', started_at, 'unixepoch') = strftime('%Y', 'now')
                `;
			break;

		case "month":
			query += `
                    AND strftime('%m-%Y', started_at, 'unixepoch') = strftime('%m-%Y', 'now')
                `;
			break;

		case "year":
			query += `
                    AND strftime('%Y', started_at, 'unixepoch') = strftime('%Y', 'now')
                `;
			break;

		case "all":
		default:
			// no time filter
			break;
	}

	const row = db.prepare(query).get(videoId);
	return row?.total ?? 0; // return 0 if null
}
