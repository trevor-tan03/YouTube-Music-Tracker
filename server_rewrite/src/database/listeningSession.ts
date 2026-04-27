import {
    type ColumnType,
    type Generated,
    type Insertable,
    type Selectable,
    type Updateable,
} from "kysely";

export interface ListeningSessionTable {
    id: Generated<number>;
    video_id: string;
    listening_time: number;
    started_at: ColumnType<Date, string | undefined, never>;
}
export type ListeningSession = Selectable<ListeningSessionTable>;
export type NewListeningSession = Insertable<ListeningSessionTable>;
export type UpdateListeningSession = Updateable<ListeningSessionTable>;
