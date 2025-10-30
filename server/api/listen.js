import { db } from "../database.js";

export async function addSongListeningTime(req, res) {
	try {
		const { videoId, listeningTime } = req.body;

		if (!videoId || !listeningTime) {
			return res.status(400).json({
				error: "Missing required fields: videoId, listeningTime",
			});
		} else if (typeof listeningTime !== "number") {
			return res.status(400).json({
				error: "listeningTime must be a number",
			});
		}

		// Check if the video is registered and is a song
		const existingVideo = db
			.prepare(`SELECT * FROM video WHERE id = ?`)
			.get(videoId);

		if (existingVideo && existingVideo.is_song) {
			const newListeningTime =
				existingVideo.listeningTime + listeningTime;
			increaseListeningTime(videoId, newListeningTime);

			return res.status(200).json({
				message: `Listening time increased to: ${
					newListeningTime / 60
				} mins`,
			});
		}

		return res.json(400).json({
			error: "Provided video is not considered a song. Listening time will not be added.",
		});
	} catch (error) {}
}

function increaseListeningTime(videoId, newListeningTime) {
	db.prepare("UPDATE video SET listening_time = ? WHERE id = ?").get(
		newListeningTime,
		videoId
	);
}
