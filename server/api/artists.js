import express from "express";
import { db } from "../database/database.js";

export const artistRouter = express.Router();

artistRouter.get("/", (req, res) => {
    const artists = db
        .prepare(`SELECT * FROM artist ORDER BY LOWER(name) ASC`)
        .all();
    res.json(artists);
});

artistRouter.post("/add", (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: "Artist name is required" });
    }

    if (db.prepare(`SELECT 1 FROM artist WHERE name = ?`).get(name)) {
        return res.status(400).json({ error: "Artist already exists" });
    }

    const result = db.prepare(`INSERT INTO artist (name) VALUES (?)`).run(name);
    const newArtist = db
        .prepare(`SELECT * FROM artist WHERE id = ?`)
        .get(result.lastInsertRowid);
    res.json(newArtist);
});

artistRouter.post("/map", (req, res) => {
    const { videoId, artistId } = req.body;
    if (!videoId || !artistId) {
        return res
            .status(400)
            .json({ error: "Both videoId and artistId are required" });
    }

    const artist = db
        .prepare(`SELECT id FROM artist WHERE id = ?`)
        .get(artistId);
    if (!artist) {
        return res.status(404).json({ error: "Artist not found" });
    }

    const video = db.prepare(`SELECT id FROM video WHERE id = ?`).get(videoId);
    if (!video) {
        return res.status(404).json({ error: "Video not found" });
    }

    try {
        db.prepare(
            `INSERT OR REPLACE INTO artist_song (video_id, artist_id) VALUES (?, ?)`,
        ).run(videoId, artist.id);
        res.json({ message: "Artist mapped to video successfully" });
    } catch (err) {
        res.status(500).json({
            error: "An error occurred while mapping artist to video",
        });
    }
});

artistRouter.delete("/delete/:id", (req, res) => {
    const { id } = req.params;
    const artist = db.prepare(`SELECT * FROM artist WHERE id = ?`).get(id);
    if (!artist) {
        return res.status(404).json({ error: "Artist not found" });
    }
    db.prepare(`DELETE FROM artist WHERE id = ?`).run(id);
    res.json({ message: "Artist deleted successfully" });
});

artistRouter.get("/most-listened", (req, res) => {
    const period = req.query.period;

    let periodFilter = "";
    switch (period) {
        case "day":
            periodFilter = `AND date(ls.started_at, 'unixepoch') = date('now')`;
            break;
        case "week":
            periodFilter = `AND strftime('%W-%Y', ls.started_at, 'unixepoch') = strftime('%W-%Y', 'now')`;
            break;
        case "month":
            periodFilter = `AND strftime('%m-%Y', ls.started_at, 'unixepoch') = strftime('%m-%Y', 'now')`;
            break;
        case "year":
            periodFilter = `AND strftime('%Y', ls.started_at, 'unixepoch') = strftime('%Y', 'now')`;
            break;
        default:
            break;
    }

    const artists = db
        .prepare(
            `SELECT 
                a.id AS artist_id,  
                a.name AS artist_name,
                COUNT(DISTINCT v.id) AS song_count,
                SUM(ls.listening_time) / 3600.0 AS total_listening_time
            FROM video v
            JOIN artist_song asg ON v.id = asg.video_id
            JOIN artist a ON asg.artist_id = a.id
            JOIN listening_session ls ON v.id = ls.video_id
            WHERE 1=1 ${periodFilter}
            GROUP BY a.id, a.name
            HAVING SUM(ls.listening_time) > 0
            ORDER BY SUM(ls.listening_time) DESC`,
        )
        .all();
    res.json(artists);
});
