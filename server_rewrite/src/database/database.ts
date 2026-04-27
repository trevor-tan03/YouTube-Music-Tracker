import SQLite from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import type {
    ArtistAliasTable,
    ArtistSongTable,
    ArtistTable,
} from "./artist.js";
import type { MusicChannelTable, NonMusicChannelTable } from "./channel.js";
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
    artist_song: ArtistSongTable;
    non_music_channel: NonMusicChannelTable;
    music_channel: MusicChannelTable;
}

const dialect = new SqliteDialect({
    database: new SQLite("youtube-music-tracker.db"),
});

export const db = new Kysely<Database>({
    dialect,
});
