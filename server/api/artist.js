import express from "express";
import { db } from "../database/database.js";

export const artistRouter = express.Router();

artistRouter.get("/list", (req, res) => {
    const artists = db.prepare(`SELECT * FROM artist`).all();
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

artistRouter.delete("/delete/:id", (req, res) => {
    const { id } = req.params;
    const artist = db.prepare(`SELECT * FROM artist WHERE id = ?`).get(id);
    if (!artist) {
        return res.status(404).json({ error: "Artist not found" });
    }
    db.prepare(`DELETE FROM artist WHERE id = ?`).run(id);
    res.json({ message: "Artist deleted successfully" });
});
