import { db } from "../database/database.js";

export async function getTopListens(req, res) {
	try {
		const topListens = db
			.prepare(
				"SELECT * FROM video ORDER BY listening_time DESC LIMIT 10"
			)
			.all();
		res.json(topListens);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
}
