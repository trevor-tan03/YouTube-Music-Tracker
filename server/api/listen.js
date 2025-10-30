import { db } from "../database.js";

export async function addSongListeningTime(req, res) {
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

		console.log(existingVideo);

		if (existingVideo && existingVideo.is_song) {
			const additionalTime = Number.parseInt(listeningTime);
			increaseListeningTime(videoId, additionalTime);

			return res.status(200).json({
				message: `Listening time increased to: ${
					newListeningTime / 60
				} mins`,
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

function increaseListeningTime(videoId, additionalTime) {
	db.prepare(
		"UPDATE video SET listening_time = listening_time + ? WHERE id = ?"
	).run(additionalTime, videoId);
}
