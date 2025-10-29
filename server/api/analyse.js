import { db } from "../database.js";
import { analyzeWithLLM } from "../util/analyzeWithLLM.js";

export async function analyseVideo(req, res) {
	try {
		// Chrome extension sends video data to this endpoint
		const { videoId, info, title, channel, description, thumbnailUrl } =
			req.body;

		console.log(req.body);

		// Validate required fields
		if (!videoId || !title || !channel) {
			return res.status(400).json({
				error: "Missing required fields: videoId, title, channel",
			});
		}

		// Check if this video's already been analyzed
		const existingVideo = db
			.prepare(`SELECT * FROM videos WHERE video_id = ?`)
			.get(videoId);

		if (existingVideo) {
			// Video already exists, return existing data
			const analysis = db
				.prepare(`SELECT * FROM video_analysis WHERE video_id = ?`)
				.get(videoId);

			return res.json({
				alreadyExists: true,
				video: existingVideo,
				analysis: analysis,
				message: "Video already analyzed",
			});
		}

		// If not, make request to LLM to determine if video's a song or not
		await analyzeWithLLM(
			videoId,
			info,
			title,
			channel,
			description,
			thumbnailUrl
		);

		return res.status(200).json({
			message: "bruh",
		});
	} catch (err) {
		console.error("Error in analyseVideo:", err);
		res.status(500).json({ error: err.message });
	}
}
