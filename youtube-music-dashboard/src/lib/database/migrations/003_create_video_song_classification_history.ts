import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("video_song_classification_history")
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("video_id", "text", (col) =>
            col.notNull().references("video.id").onDelete("cascade"),
        )
        .addColumn("is_song", "integer", (col) => col.notNull())
        .addColumn("type", "text", (col) => col.notNull()) // "manual" | "heuristic" | "llm"
        .addColumn("reason", "text")
        .addColumn("classified_at", "text", (col) =>
            col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
        )
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("video_song_classification_history").execute();
}
