import {
    type ColumnType,
    type Generated,
    type Insertable,
    type Selectable,
    type Updateable,
} from "kysely";

export interface ChannelTable {
    id: Generated<number>;
    channel_id: string | null;
    channel_name: string;
    channel_icon: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
    is_music_channel: 0 | 1;
}
export type Channel = Selectable<ChannelTable>;
export type NewChannel = Insertable<ChannelTable>;
export type UpdateChannel = Updateable<ChannelTable>;
