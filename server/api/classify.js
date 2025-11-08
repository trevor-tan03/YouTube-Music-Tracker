import { db } from "../database/database.js";

export async function classifySong(req, res) {
	const { videoId, isSong } = req.body;

	if (!videoId || isSong === undefined) {
		return res.status(400).json({
			error: "Missing required fields: videoId, isSong",
		});
	}

	const existingVideo = db
		.prepare("SELECT id FROM video WHERE id = ?")
		.get(videoId);

	if (!existingVideo) {
		return res.status(404).json({
			error: "Video with specified id does not exist",
		});
	}

	db.prepare("UPDATE video SET is_song = ? WHERE id = ?").run(
		isSong ? 1 : 0,
		videoId
	);

	console.log(`isSong has been set to: ${isSong}`);
	return res.status(200).json({
		message: `isSong has been set to: ${isSong}`,
		isSong,
	});
}
