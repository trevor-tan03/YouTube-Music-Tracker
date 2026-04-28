import {
    type ColumnType,
    type Generated,
    type Insertable,
    type Selectable,
} from "kysely";

export interface VideoTable {
    id: string;
    title: string;
    channel: string;
    description: string | undefined;
    duration: number;
    genre: string | undefined;
    is_song: 0 | 1;
    created_at: ColumnType<Date, string | undefined, never>;
}
export type Video = Selectable<VideoTable>;
export type NewVideo = Insertable<VideoTable>;

export interface VideoSongClassificationHistoryTable {
    id: Generated<number>;
    video_id: string;
    is_song: 0 | 1;
    type: "manual" | "heuristic" | "llm";
    reason: string | undefined;
    classified_at: ColumnType<Date, string | undefined, never>;
}

export type VideoSongClassificationHistory =
    Selectable<VideoSongClassificationHistoryTable>;
export type NewVideoSongClassificationHistory =
    Insertable<VideoSongClassificationHistoryTable>;
