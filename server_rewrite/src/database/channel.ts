import {
    type ColumnType,
    type Generated,
    type Insertable,
    type Selectable,
    type Updateable,
} from "kysely";

export interface NonMusicChannelTable {
    id: Generated<number>;
    channel_name: string;
    created_at: ColumnType<Date, string | undefined, never>;
}
export type NonMusicChannel = Selectable<NonMusicChannelTable>;
export type NewNonMusicChannel = Insertable<NonMusicChannelTable>;
export type UpdateNonMusicChannel = Updateable<NonMusicChannelTable>;

export interface MusicChannelTable {
    id: Generated<number>;
    channel_name: string;
    created_at: ColumnType<Date, string | undefined, never>;
}
export type MusicChannel = Selectable<MusicChannelTable>;
export type NewMusicChannel = Insertable<MusicChannelTable>;
export type UpdateMusicChannel = Updateable<MusicChannelTable>;
