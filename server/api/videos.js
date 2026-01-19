import { db } from "../database/database.js";

export async function getVideos(req, res) {
  try {
    // Query params
    const searchFilter = req.query.search || "";
    const classification = req.query.classification; // song | video | unknown
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sortBy || "recent";

    // ---------------------------------------------------------
    // WHERE CLAUSE
    // ---------------------------------------------------------
    let whereConditions = [];
    let params = [];

    // Search
    if (searchFilter) {
      whereConditions.push("(v.title LIKE ? OR v.channel LIKE ?)");
      params.push(`%${searchFilter}%`, `%${searchFilter}%`);
    }

    // Classification filter
    if (classification === "song") {
      whereConditions.push("v.is_song = 1");
    } else if (classification === "video") {
      whereConditions.push("v.is_song = 0");
    } else if (classification === "unknown") {
      whereConditions.push("v.is_song IS NULL");
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // ---------------------------------------------------------
    // SORTING LOGIC
    // ---------------------------------------------------------
    let orderBy = "v.created_at ASC"; // default (recent)

    switch (sortBy) {
      case "oldest":
        orderBy = "v.created_at DESC";
        break;

      case "title":
        orderBy = "v.title COLLATE NOCASE ASC";
        break;

      case "duration-desc":
        orderBy = "v.duration DESC";
        break;

      case "duration-asc":
        orderBy = "v.duration ASC";
        break;

      case "most-played":
        orderBy = "total_listening_time DESC";
        break;
    }

    // ---------------------------------------------------------
    // COUNT QUERY (no LIMIT/OFFSET)
    // ---------------------------------------------------------
    const countQuery = `
            SELECT COUNT(*) as total
            FROM video v
            ${whereClause}
        `;
    const total = db.prepare(countQuery).get(...params).total;

    // ---------------------------------------------------------
    // MAIN QUERY WITH LISTENING TIME
    // ---------------------------------------------------------
    const query = `
			SELECT
				v.*,
				IFNULL(SUM(ls.listening_time), 0) AS total_listening_time,
				CASE
					WHEN v.duration > 0 THEN CAST(SUM(ls.listening_time) / v.duration AS FLOAT)
					ELSE 0
				END AS play_count
			FROM video v
			LEFT JOIN listening_session ls ON ls.video_id = v.id
			${whereClause}
			GROUP BY v.id
			ORDER BY ${orderBy}
			LIMIT ? OFFSET ?
		`;

    const videos = db.prepare(query).all(...params, limit, offset);

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
