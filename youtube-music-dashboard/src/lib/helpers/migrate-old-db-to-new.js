import Database from "better-sqlite3";

const dbOld = new Database(
    "C:/Programming/YouTube Music Tracker/server/youtube-music-tracker.db",
);
const dbNew = new Database(
    "C:/Programming/YouTube Music Tracker/youtube-music-dashboard/youtube-music-tracker.db",
);

// ---------------------------------------------------------------------------
// 1. Pull each channel from the old video table along with its earliest
//    video's created_at (unix seconds), so the channel row can carry a
//    meaningful created_at instead of "now".
// ---------------------------------------------------------------------------
const oldChannels = dbOld
    .prepare(
        `SELECT channel, MIN(created_at) AS earliest_created_at
         FROM video
         WHERE channel IS NOT NULL
         GROUP BY channel`,
    )
    .all();

console.log(`Found ${oldChannels.length} distinct channels in old db`);

// unix seconds -> ISO string, matching the conversion used for videos below
function toIso(unixSeconds) {
    return unixSeconds
        ? new Date(unixSeconds * 1000).toISOString()
        : new Date().toISOString();
}

// ---------------------------------------------------------------------------
// 2. Insert channels into the new db's channel table, building a name -> id map
//    (skip channels that already exist, in case this is re-run)
// ---------------------------------------------------------------------------
const insertChannel = dbNew.prepare(
    `INSERT INTO channel (name, avatar, created_at) VALUES (?, NULL, ?)`,
);
const findChannel = dbNew.prepare(`SELECT id FROM channel WHERE name = ?`);

const channelNameToId = new Map();

const insertChannels = dbNew.transaction((channels) => {
    for (const { channel, earliest_created_at } of channels) {
        const existing = findChannel.get(channel);
        if (existing) {
            channelNameToId.set(channel, existing.id);
            continue;
        }
        const info = insertChannel.run(channel, toIso(earliest_created_at));
        channelNameToId.set(channel, Number(info.lastInsertRowid));
    }
});

insertChannels(oldChannels);
console.log(`Channel table now has mappings for ${channelNameToId.size} names`);

// ---------------------------------------------------------------------------
// 3. Pull all videos from the old db
// ---------------------------------------------------------------------------
const oldVideos = dbOld.prepare(`SELECT * FROM video`).all();
console.log(`Found ${oldVideos.length} videos in old db`);

// ---------------------------------------------------------------------------
// 4. Insert videos into the new db, resolving channel name -> channel_id
//    and converting the old unix-seconds created_at into an ISO string.
//    description doesn't exist in the old schema, so it's inserted as NULL.
// ---------------------------------------------------------------------------
const insertVideo = dbNew.prepare(`
    INSERT INTO video (id, title, channel_id, description, duration, is_song, created_at)
    VALUES (@id, @title, @channel_id, @description, @duration, @is_song, @created_at)
`);

const insertVideos = dbNew.transaction((videos) => {
    for (const v of videos) {
        const channelId = v.channel
            ? (channelNameToId.get(v.channel) ?? null)
            : null;

        // old created_at is unix seconds; new column wants an ISO date string
        const createdAtIso = toIso(v.created_at);

        insertVideo.run({
            id: v.id,
            title: v.title,
            channel_id: channelId,
            description: null,
            duration: v.duration,
            is_song: v.is_song ?? 0,
            created_at: createdAtIso,
        });
    }
});

insertVideos(oldVideos);
console.log(`Inserted ${oldVideos.length} videos into new db`);

// ---------------------------------------------------------------------------
// 5. Backfill video_song_classification_history for every migrated video.
//    These videos predate the classification-history table, so there's no
//    real classification event to record — insert one row per video with
//    type "unknown", using the video's own created_at as classified_at
//    (the closest available timestamp).
// ---------------------------------------------------------------------------
const insertClassification = dbNew.prepare(`
    INSERT INTO video_song_classification_history (video_id, is_song, type, classified_at)
    VALUES (@video_id, @is_song, 'unknown', @classified_at)
`);

const insertClassifications = dbNew.transaction((videos) => {
    for (const v of videos) {
        insertClassification.run({
            video_id: v.id,
            is_song: v.is_song ?? 0,
            classified_at: toIso(v.created_at),
        });
    }
});

insertClassifications(oldVideos);
console.log(`Inserted ${oldVideos.length} classification history rows`);

// ---------------------------------------------------------------------------
// 6. Create the dummy "Unmapped" artist, used as a fallback for any video
//    that never had a row in the old artist_song table.
// ---------------------------------------------------------------------------
const findArtistByName = dbNew.prepare(`SELECT id FROM artist WHERE name = ?`);
const insertArtist = dbNew.prepare(
    `INSERT INTO artist (name, channel_id, created_at) VALUES (@name, @channel_id, @created_at)`,
);

let unmappedArtist = findArtistByName.get("Unmapped");
let unmappedArtistId;
if (unmappedArtist) {
    unmappedArtistId = unmappedArtist.id;
} else {
    const info = insertArtist.run({
        name: "Unmapped",
        channel_id: null,
        created_at: new Date().toISOString(),
    });
    unmappedArtistId = Number(info.lastInsertRowid);
}
console.log(`"Unmapped" artist id: ${unmappedArtistId}`);

// ---------------------------------------------------------------------------
// 7. Migrate the old artist table into the new one, building an
//    old artist id -> new artist id map. The old table has no channel_id,
//    so that's inserted as NULL.
// ---------------------------------------------------------------------------
const oldArtists = dbOld.prepare(`SELECT * FROM artist`).all();
console.log(`Found ${oldArtists.length} artists in old db`);

const artistIdMap = new Map();

const insertArtists = dbNew.transaction((artists) => {
    for (const a of artists) {
        const existing = findArtistByName.get(a.name);
        if (existing) {
            artistIdMap.set(a.id, existing.id);
            continue;
        }
        const info = insertArtist.run({
            name: a.name,
            channel_id: null,
            created_at: toIso(a.created_at),
        });
        artistIdMap.set(a.id, Number(info.lastInsertRowid));
    }
});

insertArtists(oldArtists);
console.log(`Artist table now has mappings for ${artistIdMap.size} artists`);

// ---------------------------------------------------------------------------
// 8. Migrate artist_song -> artist_video for videos that had a mapping,
//    then fall back to the "Unmapped" artist for every video that didn't.
//    mapping_type is "unknown" either way, since the old schema never
//    recorded how a video got mapped to an artist.
// ---------------------------------------------------------------------------
const oldArtistSongs = dbOld
    .prepare(`SELECT video_id, artist_id FROM artist_song`)
    .all();
console.log(`Found ${oldArtistSongs.length} artist_song rows in old db`);

const videoCreatedAt = new Map(oldVideos.map((v) => [v.id, v.created_at]));
const mappedVideoIds = new Set(oldArtistSongs.map((row) => row.video_id));

const insertArtistVideo = dbNew.prepare(`
    INSERT INTO artist_video (video_id, artist_id, mapping_type, created_at)
    VALUES (@video_id, @artist_id, 'unknown', @created_at)
`);

const insertArtistVideos = dbNew.transaction((rows) => {
    for (const row of rows) {
        const artistId = artistIdMap.get(row.artist_id) ?? unmappedArtistId;
        insertArtistVideo.run({
            video_id: row.video_id,
            artist_id: artistId,
            created_at: toIso(videoCreatedAt.get(row.video_id)),
        });
    }
});

insertArtistVideos(oldArtistSongs);
console.log(`Inserted ${oldArtistSongs.length} mapped artist_video rows`);

const unmappedVideos = oldVideos.filter((v) => !mappedVideoIds.has(v.id));

const insertUnmappedArtistVideos = dbNew.transaction((videos) => {
    for (const v of videos) {
        insertArtistVideo.run({
            video_id: v.id,
            artist_id: unmappedArtistId,
            created_at: toIso(v.created_at),
        });
    }
});

insertUnmappedArtistVideos(unmappedVideos);
console.log(
    `Inserted ${unmappedVideos.length} fallback "Unmapped" artist_video rows`,
);

dbOld.close();
dbNew.close();

console.log("Migration complete.");
