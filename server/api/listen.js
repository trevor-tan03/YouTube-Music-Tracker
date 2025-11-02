import { db } from "../database/database.js";

export async function addSongListeningTime(req, res) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "POST");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");

	try {
		const { videoId, listeningTime } = req.body;

		if (!videoId || !listeningTime) {
			return res.status(400).json({
				error: "Missing required fields: videoId, listeningTime",
			});
		} else if (isNaN(Number.parseInt(listeningTime))) {
			return res.status(400).json({
				error: "listeningTime must be a number",
			});
		}

		// Check if the video is registered and is a song
		const existingVideo = db
			.prepare(`SELECT * FROM video WHERE id = ?`)
			.get(videoId);

		if (existingVideo && existingVideo.is_song) {
			const sessionListeningTime = Number.parseInt(listeningTime);
			addListeningSession(videoId, sessionListeningTime);

			const message = `${existingVideo.title} +${Math.floor(
				sessionListeningTime / 60
			)} mins`;
			console.log(message);
			return res.status(200).json({
				message,
			});
		}

		return res.status(400).json({
			error: "Provided video is not considered a song. Listening time will not be added.",
		});
	} catch (error) {
		return res.status(500).json({
			error: `Failed to add listening time to song. ${error}`,
		});
	}
}

function addListeningSession(videoId, sessionListeningTime) {
	db.prepare(
		"INSERT INTO listening_session (video_id, listening_time) VALUES (?, ?)"
	).run(videoId, sessionListeningTime);
}
