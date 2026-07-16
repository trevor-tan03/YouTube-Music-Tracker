import {
    type ColumnType,
    type Generated,
    type Insertable,
    type Selectable,
} from "kysely";

export interface VideoTable {
    id: string;
    title: string;
    channel_id: number | null; // Foreign key to channel table. Older videos may not have a channel_id, so we need to allow nulls here
    legacy_channel_name: string | null; // Scraped the channel name directly in old videos, so we need to keep it for legacy purposes
    description: string | null;
    duration: number;
    is_song: 0 | 1;
    created_at: ColumnType<Date, string | null, never>;
}
export type Video = Selectable<VideoTable>;
export type NewVideo = Insertable<VideoTable>;

export interface VideoSongClassificationHistoryTable {
    id: Generated<number>;
    video_id: string;
    is_song: 0 | 1;
    type: "manual" | "heuristic" | "llm" | "unknown";
    classified_at: ColumnType<Date, string | null, never>;
}

export type VideoSongClassificationHistory =
    Selectable<VideoSongClassificationHistoryTable>;
export type NewVideoSongClassificationHistory =
    Insertable<VideoSongClassificationHistoryTable>;
