import { db } from "../database/database.js";

export async function getVideos(req, res) {
	try {
		// Get query parameters
		const searchFilter = req.query.search || "";
		const classification = req.query.classification; // 'song', 'video', 'unknown', or undefined for all
		const limit = parseInt(req.query.limit) || 50;
		const offset = parseInt(req.query.offset) || 0;
		const sortBy = req.query.sortBy || "recent"; // recent, oldest, most-played, duration-desc, duration-asc, title

		// Build the WHERE clause
		let whereConditions = [];
		let params = [];

		// Search filter
		if (searchFilter) {
			whereConditions.push("(title LIKE ? OR channel LIKE ?)");
			params.push(`%${searchFilter}%`, `%${searchFilter}%`);
		}

		// Classification filter
		if (classification === "song") {
			whereConditions.push("is_song = 1");
		} else if (classification === "video") {
			whereConditions.push("is_song = 0");
		} else if (classification === "unknown") {
			whereConditions.push("is_song IS NULL");
		}

		const whereClause =
			whereConditions.length > 0
				? `WHERE ${whereConditions.join(" AND ")}`
				: "";

		// Get total count for pagination info
		const countQuery = `SELECT COUNT(*) as total FROM video ${whereClause}`;
		const countResult = db.prepare(countQuery).get(...params);
		const total = countResult.total;

		// Get videos with pagination
		const query = `
			SELECT * FROM video 
			${whereClause}
			LIMIT ? OFFSET ?
		`;

		params.push(limit, offset);
		const videos = db.prepare(query).all(...params);

		// Return response with pagination metadata
		return res.status(200).json({
			videos,
			pagination: {
				total,
				limit,
				offset,
				hasMore: offset + limit < total,
				nextOffset: offset + limit < total ? offset + limit : null,
			},
		});
	} catch (error) {
		console.error("Error fetching videos:", error);
		return res.status(500).json({
			error: "Internal server error",
		});
	}
}
