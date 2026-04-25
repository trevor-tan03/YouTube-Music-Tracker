import { addVideo } from "../database/addVideo.js";
import { db } from "../database/database.js";
import { analyzeWithLLM } from "../util/analyzeWithLLM.js";
import { isLikelySong } from "../util/isLikelySong.js";

export async function analyseVideo(req, res) {
    try {
        // Chrome extension sends video data to this endpoint
        const {
            title,
            channel,
            description,
            videoId,
            thumbnailUrl,
            // duration,
            genre,
        } = req.body;
        let message;

        console.log(`\nDetected video: ${title}`);
        console.log(`Genre: ${genre || "(undefined)"}`);

        // Validate required fields
        if (!videoId || !title || !channel || !description) {
            console.error(
                "Missing required fields: videoId, title, channel, description",
            );
            return res.status(400).json({
                error: "Missing required fields: videoId, title, channel, description",
            });
        }

        // Check if this video's already been analyzed
        const existingVideo = db
            .prepare(`SELECT * FROM video WHERE id = ?`)
            .get(videoId);

        if (existingVideo) {
            if (!existingVideo.is_song) {
                message =
                    "Video is registered as NOT a song. Listening time will not be tracked.";
                console.log(message);
                return res.status(400).json({
                    message,
                    isSong: Boolean(existingVideo.is_song),
                });
            }

            // Create a new listening session for this existing song
            const sessionId = createListeningSession(videoId);
            message = `Tracking listening time of ${existingVideo.title} 🎧`;
            console.log(message);
            return res.status(200).json({
                message,
                sessionId, // Return the session ID
                isSong: Boolean(existingVideo.is_song),
            });
        }

        let result;
        let isSong = false;

        const acceptable_genres = [
            "entertainment",
            "people & blogs",
            "gaming",
            "film & animation",
        ];

        // 1. Check if the video is of a suitable genre
        if (genre === "Music") {
            isSong = true;
            message = registerVideo(req.body, true);
        } else if (acceptable_genres.includes(genre?.toLowerCase())) {
            // 2. Check video metadata against heuristics
            const {
                isSong: isClassifiedAsSong,
                score,
                confidence,
            } = isLikelySong(req.body);

            // 3. If heuristics score is medium, fallback to LLM
            if (confidence === "medium") {
                console.log(`Confidence video is song: ${confidence}`);
                console.log("Analysing with LLM...");
                result = await analyzeWithLLM(
                    title,
                    channel,
                    description,
                    genre,
                );

                if (!result) {
                    console.error(
                        "LLM analysis failed, defaulting to not a song",
                    );
                    isSong = false;
                    message = registerVideo(req.body, false);
                } else {
                    isSong = result.isSong;
                    console.log(
                        `LLM result: isSong=${isSong}, confidence=${result.confidence}, reasoning=${result.reasoning}`,
                    );
                    message = registerVideo(req.body, isSong);
                }
            } else if (confidence === "high") {
                console.log(
                    `High confidence this video is a song with a heuristic score of ${score}`,
                );
                isSong = true;
                message = registerVideo(req.body, isSong);
            } else {
                // If confidence is low, assume it's not a song
                console.log(
                    `Low confidence this video is a song with a heuristic score of ${score}`,
                );
                isSong = false;
                message = registerVideo(req.body, isSong);
            }
        } else {
            // 3. For all other genres, register as not a song
            console.log(`Genre "${genre}" is not suitable for music content`);
            isSong = false;
            message = registerVideo(req.body, false);
        }

        // Create listening session only if it's a song
        const sessionId = isSong ? createListeningSession(videoId) : null;

        return res.status(201).json({
            message,
            sessionId, // Return the session ID (or null if not a song)
            isSong,
        });
    } catch (err) {
        console.error("Error in analyseVideo:", err);
        res.status(500).json({ error: err.message });
    }
}

function registerVideo(details, isSong) {
    addVideo({ ...details, isSong });
    const message = `Registered ${details.title} as ${
        isSong ? "" : "NOT "
    }a song.`;

    if (isSong) {
        const UNMAPPED_ARTIST_ID = 98;
        db.prepare(
            "INSERT INTO artist_song (video_id, artist_id) VALUES (?, ?)",
        ).run(details.videoId, UNMAPPED_ARTIST_ID);

        const matchedArtistId = searchAgainstExistingArtists(details);
        if (matchedArtistId) {
            db.prepare(
                "UPDATE artist_song SET artist_id = ? WHERE video_id = ?",
            ).run(matchedArtistId, details.videoId);
            console.log(
                `Updated artist mapping for video "${details.title}" to artist ID ${matchedArtistId}`,
            );
        }
    }

    console.log(message);
    return message;
}

function searchAgainstExistingArtists(details) {
    const artists = db
        .prepare("SELECT * FROM artist ORDER BY LENGTH(name) DESC")
        .all();

    for (const artist of artists) {
        const escaped = artist.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const wordBoundary = new RegExp(`\\b${escaped}\\b`, "i");

        const nameMatch = wordBoundary.test(details.title);
        const channelMatch =
            details.channel.toLowerCase() === artist.name.toLowerCase();

        if (nameMatch || channelMatch) {
            console.log(
                `Matched artist "${artist.name}" for video "${details.title}" based on ${
                    nameMatch ? "title" : "channel"
                }`,
            );
            return artist.id;
        }
    }
    return null;
}

function createListeningSession(videoId) {
    const result = db
        .prepare(
            "INSERT INTO listening_session (video_id, listening_time) VALUES (?, 0)",
        )
        .run(videoId);
    return result.lastInsertRowid;
}
