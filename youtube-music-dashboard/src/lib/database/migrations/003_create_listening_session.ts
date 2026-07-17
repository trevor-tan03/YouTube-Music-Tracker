import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("listening_session")
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("video_id", "text", (col) =>
            col.notNull().references("video.id").onDelete("cascade"),
        )
        .addColumn("listening_time", "integer", (col) => col.notNull())
        .addColumn("started_at", "text", (col) =>
            col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
        )
        .execute();

    await db.schema
        .createIndex("listening_session_video_id_idx")
        .on("listening_session")
        .column("video_id")
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("listening_session").execute();
}
