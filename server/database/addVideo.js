import { db } from "../database.js";

export function addVideo(videoDetails) {
	const insertVideo = db.prepare(`
        INSERT INTO video (id, title, channel, duration, thumbnail_url, is_song)
        VALUES (?, ?, ?, ?, ?, ?)
        `);

	const { videoId, title, duration, channel, thumbnailUrl, isSong } =
		videoDetails;

	insertVideo.run(videoId, title, channel, duration, thumbnailUrl, isSong);
}
