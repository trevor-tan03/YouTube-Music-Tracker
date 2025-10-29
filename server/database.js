import Database from "better-sqlite3";

export const db = new Database("./youtube-music-tracker.db");

// Create tables

// Graceful shutdown
process.on("SIGINT", () => {
	db.close();
	console.log("Database connection closed");
	process.exit(0);
});
