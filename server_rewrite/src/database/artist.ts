import {
    type ColumnType,
    type Generated,
    type Insertable,
    type Selectable,
    type Updateable,
} from "kysely";

export interface ArtistTable {
    id: Generated<number>;
    name: string;
    created_at: ColumnType<Date, string | undefined, never>;
}
export type Artist = Selectable<ArtistTable>;
export type NewArtist = Insertable<ArtistTable>;
export type UpdateArtist = Updateable<ArtistTable>;

export interface ArtistAliasTable {
    id: Generated<number>;
    artist_id: number;
    alias: string;
}
export type ArtistAlias = Selectable<ArtistAliasTable>;
export type NewArtistAlias = Insertable<ArtistAliasTable>;
export type UpdateArtistAlias = Updateable<ArtistAliasTable>;

export interface ArtistSongTable {
    video_id: string;
    artist_id: number;
    mapping_type: "manual" | "heuristic" | "llm";
}
export type ArtistSong = Selectable<ArtistSongTable>;
export type NewArtistSong = Insertable<ArtistSongTable>;
export type UpdateArtistSong = Updateable<ArtistSongTable>;
