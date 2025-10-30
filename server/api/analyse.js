import { db } from "../database.js";
import { addVideo } from "../database/addVideo.js";
import { analyzeWithLLM } from "../util/analyzeWithLLM.js";

export async function analyseVideo(req, res) {
	try {
		// Chrome extension sends video data to this endpoint
		const { videoId, info, title, channel, description, thumbnailUrl } =
			req.body;
		let message;

		// Validate required fields
		if (!videoId || !title || !channel) {
			console.error("Missing required fields: videoId, title, channel");
			return res.status(400).json({
				error: "Missing required fields: videoId, title, channel",
			});
		}

		// Check if this video's already been analyzed
		const existingVideo = db
			.prepare(`SELECT * FROM video WHERE id = ?`)
			.get(videoId);

		if (existingVideo && existingVideo.is_song) {
			message = "Tracking listening time 🎧";
			return res.status(200).json({
				message,
			});
		}

		// If not, make request to LLM to determine if video's a song or not
		const result = await analyzeWithLLM(
			videoId,
			info,
			title,
			channel,
			description,
			thumbnailUrl
		);

		if (result) {
			const isSong = result.isSong;
			addVideo({ ...req.body, isSong });
			message = `Registered ${title} as ${isSong ? "" : "NOT "}a song.`;
			return res.status(201).json({
				message,
			});
		} else {
			throw new Error("Invalid LLM output format");
		}
	} catch (err) {
		console.error("Error in analyseVideo:", err);
		res.status(500).json({ error: err.message });
	}
}
