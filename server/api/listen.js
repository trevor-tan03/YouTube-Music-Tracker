import { db } from "../database/database.js";

export async function addSongListeningTime(req, res) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "POST");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type");

	try {
		const { sessionId, listeningTime } = req.body;
		console.log("provided sessionId:", sessionId);

		if (!sessionId || !listeningTime) {
			return res.status(400).json({
				error: "Missing required fields: sessionId, listeningTime",
			});
		} else if (isNaN(Number.parseInt(listeningTime))) {
			return res.status(400).json({
				error: "listeningTime must be a number",
			});
		}

		const sessionListeningTime = Number.parseInt(listeningTime);

		// Update the listening session
		const session = db
			.prepare(`SELECT * FROM listening_session WHERE id = ?`)
			.get(sessionId);

		if (!session) {
			return res.status(404).json({
				error: "Listening session not found",
			});
		}

		// Update the session with cumulative time
		db.prepare(
			"UPDATE listening_session SET listening_time = ? WHERE id = ?"
		).run(sessionListeningTime, sessionId);

		// Get video details for the response
		const video = db
			.prepare(`SELECT * FROM video WHERE id = ?`)
			.get(session.video_id);

		const message = `${video.title} - ${Math.floor(
			sessionListeningTime / 60
		)} mins total`;
		console.log(message);

		return res.status(200).json({
			message,
		});
	} catch (error) {
		return res.status(500).json({
			error: `Failed to add listening time to song. ${error}`,
		});
	}
}
