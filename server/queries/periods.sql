-- SELECT strftime('%Y', ls.started_at, 'unixepoch') = strftime('%Y', 'now') FROM listening_session ls WHERE id = 13

	SELECT 
		v.id as video_id,
		v.title,
		v.channel,
		v.duration,
		v.thumbnail_url,
		strftime('%W-%Y', ls.started_at, 'unixepoch') as period,
		ls.listening_time
	FROM listening_session ls
	LEFT JOIN video v ON ls.video_id = v.id
	WHERE strftime('%Y', ls.started_at, 'unixepoch') = "2025" AND video_id = "RblIsNFR1j4"
	ORDER BY ls.listening_time DESC