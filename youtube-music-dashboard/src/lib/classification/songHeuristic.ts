import { db } from "../database/database.js";

export interface HeuristicSignal {
    field: "genre" | "duration" | "channel" | "title" | "description";
    signal: string;
    score: number;
}

// export interface HeuristicResult {
//     isSong: boolean;
//     confidence: "low" | "medium" | "high";
//     score: number;
//     signals: HeuristicSignal[];
//     reason: string;
//     type: "heuristic";
// }

export async function heuristicsCheck(
    title: string,
    channel: string,
    description: string,
    duration: number,
    genre: string,
) {
    const signals: HeuristicSignal[] = [];
    let score = 0;

    const addSignal = (
        field: HeuristicSignal["field"],
        signal: string,
        value: number,
    ) => {
        score += value;
        signals.push({ field, signal, score: value });
    };

    // Music genre means 100% a song — return immediately
    if (genre.toLowerCase() === "music") {
        return {
            isSong: true,
            confidence: "high",
            score: 99,
            signals: [{ field: "genre", signal: "genre=Music", score: 99 }],
            reason: "YouTube classified this video as Music genre",
            type: "heuristic",
        };
    }

    // ===========================================================================
    // GENRE
    // ===========================================================================

    const genreLower = genre.toLowerCase();
    if (
        genreLower === "science & technology" ||
        genreLower === "gaming" ||
        genreLower === "education"
    ) {
        addSignal("genre", `genre=${genre}`, -3);
    }

    // ===========================================================================
    // DURATION
    // Distribution: 180–240 s = 96 % songs | 240–300 s = 85 % | 120–180 s = 77 %
    //               300–360 s = 37 %        | 360–480 s = 19 % | 480–600 s =  4 %
    //               600 s+   =  3 %         | <90 s     = 18 % | 90–120 s  = 37 %
    // ===========================================================================

    if (duration >= 180 && duration < 240)
        addSignal("duration", "180–240s (96% songs)", 6);
    else if (duration >= 240 && duration < 300)
        addSignal("duration", "240–300s (85% songs)", 4);
    else if (duration >= 120 && duration < 180)
        addSignal("duration", "120–180s (77% songs)", 3);
    else if (duration >= 90 && duration < 120)
        addSignal("duration", "90–120s (37% songs)", -1);
    else if (duration < 90) addSignal("duration", "<90s (18% songs)", -4);
    else if (duration >= 300 && duration < 360)
        addSignal("duration", "300–360s (37% songs)", -2);
    else if (duration >= 360 && duration < 480)
        addSignal("duration", "360–480s (19% songs)", -3);
    else if (duration >= 480 && duration < 600)
        addSignal("duration", "480–600s (4% songs)", -5);
    else if (duration >= 600) addSignal("duration", "600s+ (3% songs)", -6);

    // ===========================================================================
    // CHANNEL
    // ===========================================================================

    const channelLower = channel.toLowerCase();

    // YouTube Music auto-generated "Artist – Topic" channels
    if (/ - topic$/i.test(channelLower)) {
        addSignal("channel", "YouTube Music Topic channel", 7);
    }
    ``;

    // Known music channels from DB — use executeTakeFirst (not OrThrow) since
    // most channels won't be in the table
    const matchingMusicChannel = await db
        .selectFrom("channel")
        .select("channel_name")
        .where("channel_name", "like", `%${channel}%`)
        .where("is_music_channel", "=", 1)
        .executeTakeFirst();

    if (matchingMusicChannel) {
        addSignal(
            "channel",
            `known music channel: ${matchingMusicChannel.channel_name}`,
            2,
        );
    }

    // Known non-music channels from DB
    const nonMusicChannels = await db
        .selectFrom("channel")
        .select("channel_name")
        .where("is_music_channel", "=", 0)
        .execute();

    for (const ch of nonMusicChannels) {
        if (channelLower.includes(ch.channel_name.toLowerCase())) {
            addSignal(
                "channel",
                `known non-music channel: ${ch.channel_name}`,
                -6,
            );
            break;
        }
    }

    // Clip channels (react/highlight aggregators)
    if (/clips?$/i.test(channelLower) && !channelLower.includes("live")) {
        addSignal("channel", "clips channel suffix", -3);
    }

    if (channelLower.includes("show") || channelLower.includes("podcast"))
        addSignal("channel", "show/podcast channel", -2);
    if (channelLower.includes("official") || channelLower.includes("music"))
        addSignal("channel", "official/music in channel name", 1);

    // ===========================================================================
    // TITLE
    // ===========================================================================

    const titleLower = title.toLowerCase();

    if (/\bm\/?v\b|\[m\/?v\]/.test(titleLower))
        addSignal("title", "MV / M/V tag (100% precision)", 6);

    if (
        /music video|official video|official audio|official lyric/.test(
            titleLower,
        )
    )
        addSignal("title", "official video/audio keyword (100% precision)", 6);

    if (titleLower.includes("first take"))
        addSignal("title", "first take (95%+ precision)", 5);

    if (
        /\bcovered? by\b|\bcover\b/.test(titleLower) &&
        !titleLower.includes("unboxing")
    )
        addSignal("title", "cover keyword (97% precision)", 4);

    if (/\bver\.?\b/.test(titleLower))
        addSignal("title", "ver. keyword (89% precision)", 3);

    if (/\b(feat|ft)\.?\b/.test(titleLower))
        addSignal("title", "feat/ft keyword (84% precision)", 2);

    if (/\blive clip\b/.test(titleLower))
        addSignal("title", "live clip (K-pop format)", 4);
    else if (/\b(performance|stage)\b/.test(titleLower))
        addSignal("title", "performance/stage keyword", 2);
    else if (/\b(acoustic|remix|lyric|lyrics)\b/.test(titleLower))
        addSignal("title", "acoustic/remix/lyric keyword", 2);
    else if (/\blive\b/.test(titleLower))
        addSignal("title", "live keyword (weaker signal)", 1);

    if (title.includes("최초공개"))
        addSignal("title", "Korean premiere tag 최초공개", 4);

    if (/^[^-]+ - [^-]+$/.test(title))
        addSignal("title", "Artist – Song dash pattern", 3);

    if (/["'「『\u201c\u2018].+["'」』\u201d\u2019]/.test(title))
        addSignal("title", "quoted song title", 2);

    if (/\([^)]*ver[^)]*\)/i.test(titleLower))
        addSignal("title", "version in parentheses", 1);

    if (/[\u3040-\u9fff\uac00-\ud7ff]/.test(title))
        addSignal("title", "CJK characters (74% of songs)", 1);

    // Negative title signals
    if (/\bplaylist\b|full album|full ep/.test(titleLower))
        addSignal("title", "playlist/full album (compilation, not a song)", -5);

    if (/\b(reaction|review|tutorial|how to|unboxing)\b/.test(titleLower))
        addSignal("title", "reaction/review/tutorial keyword", -5);

    if (/\b(podcast|interview|vlog|trailer)\b/.test(titleLower))
        addSignal("title", "podcast/interview/vlog keyword", -4);

    if (/\bexplained?\b|\bbreakdown\b|\banalysis\b/.test(titleLower))
        addSignal("title", "explained/breakdown/analysis keyword", -4);

    if (/\bepisode\b|\bep\.\s*\d+\b|\bseason\b/.test(titleLower))
        addSignal("title", "episode/season format", -3);

    if (/ノンクレジット|non-?credit\s*(op|ed|opening|ending)/i.test(titleLower))
        addSignal("title", "anime non-credit OP/ED clip", -3);

    if (/full\s*(concert|show|set)/.test(titleLower))
        addSignal("title", "full concert/show recording", -4);

    if (/\blive\s*stream\b|\blive\s*watch\b/.test(titleLower))
        addSignal("title", "live stream/watch", -4);

    // ===========================================================================
    // DESCRIPTION
    // ===========================================================================

    if (description) {
        const descLower = description.toLowerCase();

        if (descLower.includes("lyrics"))
            addSignal("description", "lyrics in description", 4);

        const streamingKws = [
            "spotify",
            "apple music",
            "soundcloud",
            "out now",
            "streaming",
            "download",
        ];
        for (const kw of streamingKws) {
            if (descLower.includes(kw)) {
                addSignal("description", `streaming keyword: ${kw}`, 2);
                break;
            }
        }

        const creditPatterns = [
            "lyrics:",
            "music:",
            "arrangement:",
            "composed by",
            "vocals:",
        ];
        for (const p of creditPatterns) {
            if (descLower.includes(p)) {
                addSignal("description", `music credit pattern: ${p}`, 2);
                break;
            }
        }

        const sponsorKws = [
            "sponsor",
            "sponsored by",
            "use code",
            "affiliate",
            "promo code",
        ];
        for (const kw of sponsorKws) {
            if (descLower.includes(kw)) {
                addSignal("description", `sponsor keyword: ${kw}`, -3);
                break;
            }
        }
    }

    // ===========================================================================
    // DECISION
    // ===========================================================================

    const isSong = score >= 3;
    const confidence = score >= 7 ? "high" : score >= 3 ? "medium" : "low";

    const topSignals = [...signals]
        .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
        .slice(0, 3)
        .map((s) => `${s.signal} (${s.score > 0 ? "+" : ""}${s.score})`)
        .join(", ");

    return {
        isSong,
        confidence,
        score,
        signals,
        reason: topSignals,
        type: "heuristic",
    };
}
