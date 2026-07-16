import { Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
    await db.schema
        .createTable("artist")
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("name", "text", (col) => col.notNull().unique())
        .addColumn("picture", "text")
        .addColumn("channel_id", "integer", (col) =>
            col.references("channel.id").onDelete("set null"),
        )
        .addColumn("created_at", "text", (col) =>
            col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
        )
        .execute();

    await db.schema
        .createTable("artist_alias")
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("artist_id", "integer", (col) =>
            col.notNull().references("artist.id").onDelete("cascade"),
        )
        .addColumn("alias", "text", (col) => col.notNull())
        .execute();

    await db.schema
        .createIndex("artist_alias_alias_idx")
        .on("artist_alias")
        .column("alias")
        .execute();

    await db.schema
        .createTable("artist_song")
        .addColumn("artist_song_id", "integer", (col) =>
            col.primaryKey().autoIncrement(),
        )
        .addColumn("video_id", "text", (col) =>
            col.notNull().references("video.id").onDelete("cascade"),
        )
        .addColumn("artist_id", "integer", (col) =>
            col.notNull().references("artist.id").onDelete("cascade"),
        )
        .addColumn("mapping_type", "text", (col) => col.notNull())
        .execute();

    await db.schema
        .createIndex("artist_song_video_id_idx")
        .on("artist_song")
        .column("video_id")
        .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await db.schema.dropTable("artist_song").execute();
    await db.schema.dropTable("artist_alias").execute();
    await db.schema.dropTable("artist").execute();
}
