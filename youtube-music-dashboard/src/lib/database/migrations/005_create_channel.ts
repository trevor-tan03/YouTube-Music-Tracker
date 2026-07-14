import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("channel")
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("channel_name", "text", (col) => col.notNull().unique())
        .addColumn("is_music_channel", "integer", (col) => col.notNull())
        .addColumn("created_at", "text", (col) =>
            col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
        )
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("channel").execute();
}
