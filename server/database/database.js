import Database from "better-sqlite3";

export const db = new Database("./youtube-music-tracker.db");

// Video table
db.prepare(
	`
    CREATE TABLE IF NOT EXISTS video (
        id TEXT PRIMARY KEY,        -- YouTube video id
        title TEXT NOT NULL,
        channel TEXT,
        duration INTEGER,              -- video length in seconds
        is_song INTEGER DEFAULT 0,     -- boolean (0/1)
        thumbnail_url TEXT
    );
    `
).run();

db.prepare(
	`CREATE TABLE IF NOT EXISTS listening_session (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT NOT NULL,
        listening_time INTEGER DEFAULT 0,
        started_at INTEGER DEFAULT (strftime('%s', 'now')),  -- Unix timestamp
        FOREIGN KEY (video_id) REFERENCES video(id) ON DELETE CASCADE
    )`
).run();

// Main song table
db.prepare(
	`
    CREATE TABLE IF NOT EXISTS main_song (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER NOT NULL,
        artist TEXT NOT NULL,
        song TEXT NOT NULL,
        FOREIGN KEY (video_id) REFERENCES video(id) ON DELETE CASCADE
    );
    `
).run();

// Re-coded (alternate upload of same song)
db.prepare(
	`
    CREATE TABLE IF NOT EXISTS recode_song (
        main_song_id INTEGER NOT NULL,
        video_id INTEGER NOT NULL,
        PRIMARY KEY (main_song_id, video_id),
        FOREIGN KEY (main_song_id) REFERENCES main_song(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES video(id) ON DELETE CASCADE
    );
    `
).run();

db.prepare(`CREATE INDEX IF NOT EXISTS idx_video_id ON video(id);`).run();
db.prepare(
	`CREATE INDEX IF NOT EXISTS idx_main_song_video ON main_song(video_id);`
).run();

// Graceful shutdown
process.on("SIGINT", () => {
	db.close();
	console.log("Database connection closed");
	process.exit(0);
});
