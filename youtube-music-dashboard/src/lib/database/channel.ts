import {
    type ColumnType,
    type Generated,
    type Insertable,
    type Selectable,
    type Updateable,
} from "kysely";

export interface ChannelTable {
    id: Generated<number>;
    name: string;
    avatar: string | null;
    created_at: ColumnType<Date, string | undefined, never>;
}
export type Channel = Selectable<ChannelTable>;
export type NewChannel = Insertable<ChannelTable>;
export type UpdateChannel = Updateable<ChannelTable>;
