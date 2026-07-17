import SQLite from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import type {
    ArtistAliasTable,
    ArtistTable,
    ArtistVideoTable,
} from "./artist.js";
import type { ChannelTable } from "./channel.js";
import type { ListeningSessionTable } from "./listeningSession.js";
import type {
    VideoSongClassificationHistoryTable,
    VideoTable,
} from "./video.js";

export interface Database {
    video: VideoTable;
    listening_session: ListeningSessionTable;
    video_song_classification_history: VideoSongClassificationHistoryTable;
    artist: ArtistTable;
    artist_alias: ArtistAliasTable;
    artist_video: ArtistVideoTable;
    channel: ChannelTable;
}

export const sqliteDb = new SQLite("youtube-music-tracker.db");

const dialect = new SqliteDialect({
    database: sqliteDb,
});

export const db = new Kysely<Database>({
    dialect,
});
