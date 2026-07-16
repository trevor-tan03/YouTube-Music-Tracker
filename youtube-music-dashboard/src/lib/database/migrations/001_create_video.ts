import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("video")
        .addColumn("id", "text", (col) => col.primaryKey())
        .addColumn("title", "text", (col) => col.notNull())
        .addColumn("channel_id", "integer", (col) =>
            col.notNull().references("channel.id").onDelete("set null"),
        )
        .addColumn("legacy_channel_name", "text")
        .addColumn("description", "text")
        .addColumn("duration", "integer", (col) => col.notNull())
        .addColumn("is_song", "integer", (col) => col.notNull())
        .addColumn("created_at", "text", (col) =>
            col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
        )
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("video").execute();
}
