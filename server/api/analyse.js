import { addVideo } from "../database/addVideo.js";
import { db } from "../database/database.js";
import { analyzeWithLLM } from "../util/analyzeWithLLM.js";

export async function analyseVideo(req, res) {
	try {
		// Chrome extension sends video data to this endpoint
		const {
			title,
			channel,
			description,
			videoId,
			thumbnailUrl,
			// duration,
			genre,
		} = req.body;
		let message;

		console.log(`\nDetected video: ${title}`);

		// Validate required fields
		if (!videoId || !title || !channel || !description) {
			console.error(
				"Missing required fields: videoId, title, channel, description"
			);
			return res.status(400).json({
				error: "Missing required fields: videoId, title, channel, description",
			});
		}

		// Check if this video's already been analyzed
		const existingVideo = db
			.prepare(`SELECT * FROM video WHERE id = ?`)
			.get(videoId);

		if (existingVideo) {
			if (!existingVideo.is_song) {
				message =
					"Video is registered as NOT a song. Listening time will not be tracked.";
				console.log(message);
				return res.status(400).json({
					message,
				});
			}

			message = `Tracking listening time of ${existingVideo.title} 🎧`;
			console.log(message);
			return res.status(200).json({
				message,
			});
		}

		let result;

		// 1. Check if the video is of a suitable genre
		if (genre === "Music") {
			message = registerVideo(req.body, true);
		} else if (genre === "Entertainment" || genre === "People & Blogs") {
			// 2. If possible genre for music related video, check using LLM
			console.log("Analysing with LLM...");
			result = await analyzeWithLLM(
				videoId,
				title,
				channel,
				description,
				thumbnailUrl
			);
			message = registerVideo(req.body, result.isSong);
		}

		return res.status(201).json({
			message,
		});
	} catch (err) {
		console.error("Error in analyseVideo:", err);
		res.status(500).json({ error: err.message });
	}
}

function registerVideo(details, isSong) {
	addVideo({ ...details, isSong });
	const message = `Registered ${details.title} as ${
		isSong ? "" : "NOT "
	}a song.`;
	console.log(message);
	return message;
}
