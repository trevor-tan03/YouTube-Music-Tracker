import { db } from "@/src/lib/database/database";

async function createUnmappedArtist() {
    await db
        .insertInto("artist")
        .values({
            id: 1900,
            name: "Unmapped",
            channel_id: null,
        })
        .execute();
}

createUnmappedArtist();
