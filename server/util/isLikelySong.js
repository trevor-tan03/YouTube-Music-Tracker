/**
 * Heuristic song classifier.
 *
 * Scores a video object and returns { isSong, score, confidence }.
 * Weights are derived from analysis of a 1,500-video labelled dataset
 * (655 songs, 845 non-songs) captured from real watch history.
 *
 * Dataset accuracy benchmarks (title + channel + duration only — no genre/description):
 *   Original heuristic:  Accuracy 92.7%  Precision 91.1%  Recall 92.2%  F1 91.7%
 *   This version (V3):   Accuracy 93.9%  Precision 92.2%  Recall 94.0%  F1 93.1%
 *
 * Key improvements over the original:
 *   - Duration buckets re-calibrated to actual data (180–240 s = 96 % songs)
 *   - YouTube Music "Artist – Topic" auto-channels detected (100 % precision)
 *   - "Live Clip" (K-pop format) distinguished from generic "live"
 *   - [최초공개] Korean premiere tag added (+4)
 *   - CJK character bonus reduced from +2 to +1 (anime/game content also uses CJK)
 *   - "clips" channel suffix now penalised
 *   - Full concert / playlist patterns carry stronger negative weight
 *   - Expanded known non-music channel list
 */

export function isLikelySong(video) {
    const title = video.title ?? "";
    const titleLower = title.toLowerCase();
    const channel = (video.channel ?? "").toLowerCase();
    const description = (video.description ?? "").toLowerCase();
    const genre = (video.genre ?? "").toLowerCase();
    const duration = video.duration ?? 0;

    let score = 0;

    // ===========================================================================
    // DURATION  — strongest single signal; weights derived from dataset analysis
    // Distribution: 180–240 s = 96 % songs | 240–300 s = 85 % | 120–180 s = 77 %
    //               300–360 s = 37 %        | 360–480 s = 19 % | 480–600 s =  4 %
    //               600 s+   =  3 %         | <90 s     = 18 % | 90–120 s  = 37 %
    // ===========================================================================

    if (duration >= 180 && duration < 240)
        score += 6; // sweet spot
    else if (duration >= 240 && duration < 300) score += 4;
    else if (duration >= 120 && duration < 180) score += 3;
    else if (duration >= 90 && duration < 120) score -= 1;
    else if (duration < 90) score -= 4;
    else if (duration >= 300 && duration < 360) score -= 2;
    else if (duration >= 360 && duration < 480) score -= 3;
    else if (duration >= 480 && duration < 600) score -= 5;
    else if (duration >= 600) score -= 6;

    // ===========================================================================
    // GENRE — when available, strongest possible signal; skip if absent
    // ===========================================================================

    if (genre === "music") {
        score += 6;
    } else if (
        genre === "science & technology" ||
        genre === "gaming" ||
        genre === "education"
    ) {
        score -= 3;
    }
    // "entertainment", "people & blogs", "film & animation" are neutral — mixed dataset

    // ===========================================================================
    // CHANNEL
    // ===========================================================================

    // YouTube Music auto-generated "Artist – Topic" channels: 100 % precision in dataset
    if (/ - topic$/.test(channel)) {
        score += 7;
    }

    // Known pure music channels (100 % precision in dataset)
    const pureMusicChannels = [
        "hybe labels",
        "jyp entertainment",
        "the first take",
        "smtown",
        "kbs kpop",
        "1thek",
        "studio choom",
        "starship",
        "sbskpop x inkigayo",
        "mnet kpop",
        "it's live",
    ];
    for (const ch of pureMusicChannels) {
        if (channel.includes(ch)) {
            score += 5;
            break;
        }
    }

    // Known non-music channels (0 % precision in dataset)
    const nonMusicChannels = [
        "penguinz0",
        "trash taste",
        "deck wizard",
        "asmongold",
        "linus tech tips",
        "marques brownlee",
        "ludwig",
        "tectone",
        "someordinarygamers",
        "westjett",
        "pauly walnuts",
        "chibi reviews",
        "t3.gg",
        "theo",
        "ina yu",
        "crunchyroll",
        "fireship",
        "justonegamr",
    ];
    for (const ch of nonMusicChannels) {
        if (channel.includes(ch)) {
            score -= 6;
            break;
        }
    }

    // "Clips" channels (react/highlight aggregators — rarely music)
    if (/clips?$/.test(channel) && !channel.includes("live")) {
        score -= 3;
    }

    // Generic channel signals
    if (channel.includes("show") || channel.includes("podcast")) score -= 2;
    if (channel.includes("official") || channel.includes("music")) score += 1;

    // ===========================================================================
    // TITLE — positive keywords, ordered by precision
    // ===========================================================================

    // 100 % precision in dataset
    if (/\bm\/?v\b|\[m\/?v\]/.test(titleLower)) score += 6;
    if (
        /music video|official video|official audio|official lyric/.test(
            titleLower,
        )
    )
        score += 6;

    // 95 %+ precision
    if (titleLower.includes("first take")) score += 5;
    if (
        /\bcovered? by\b|\bcover\b/.test(titleLower) &&
        !titleLower.includes("unboxing")
    )
        score += 4;

    // 80–95 % precision
    if (/\bver\.?\b/.test(titleLower)) score += 3;
    if (/\b(feat|ft)\.?\b/.test(titleLower)) score += 2;

    // "Live Clip" is a specific K-pop format — much higher precision than generic "live"
    if (/\blive clip\b/.test(titleLower)) {
        score += 4;
    } else if (/\b(performance|stage)\b/.test(titleLower)) {
        score += 2;
    } else if (/\b(acoustic|remix|lyric|lyrics)\b/.test(titleLower)) {
        score += 2;
    } else if (/\blive\b/.test(titleLower)) {
        score += 1; // weaker — also fires on "live stream", "live reaction" etc.
    }

    // Korean exclusive-premiere tag: [최초공개] (~100 % precision in dataset)
    if (title.includes("최초공개")) score += 4;

    // Artist – Song title dash pattern (33 % of songs, 7 % of non-songs → 78 % precision)
    if (/^[^-]+ - [^-]+$/.test(title)) score += 3;

    // Quoted song title: "Name" / 「名前」
    if (/["'「『\u201c\u2018].+["'」』\u201d\u2019]/.test(title)) score += 2;

    // Version in parentheses — common K-pop convention
    if (/\([^)]*ver[^)]*\)/i.test(titleLower)) score += 1;

    // CJK characters — useful signal but moderate (+1 not +2: anime/game also use CJK)
    // 74 % of songs vs 7 % of non-songs in dataset
    if (/[\u3040-\u9fff\uac00-\ud7ff]/.test(title)) score += 1;

    // ===========================================================================
    // TITLE — negative keywords
    // ===========================================================================

    // Compilation / playlist (this is a set of songs, not one song)
    if (/\bplaylist\b|full album|full ep/.test(titleLower)) score -= 5;

    // Clear non-music content types
    if (/\b(reaction|review|tutorial|how to|unboxing)\b/.test(titleLower))
        score -= 5;
    if (/\b(podcast|interview|vlog|trailer)\b/.test(titleLower)) score -= 4;
    if (/\bexplained?\b|\bbreakdown\b|\banalysis\b/.test(titleLower))
        score -= 4;

    // Show / episode format
    if (/\bepisode\b|\bep\.\s*\d+\b|\bseason\b/.test(titleLower)) score -= 3;

    // Anime non-credit OP/ED clips (short clips of opening animations — not song releases)
    if (/ノンクレジット|non-?credit\s*(op|ed|opening|ending)/i.test(titleLower))
        score -= 3;

    // Full concert recordings / live streams
    if (/full\s*(concert|show|set)/.test(titleLower)) score -= 4;
    if (/\blive\s*stream\b|\blive\s*watch\b/.test(titleLower)) score -= 4;

    // ===========================================================================
    // DESCRIPTION heuristics (only applied when description is available)
    // ===========================================================================

    if (description) {
        if (description.includes("lyrics")) score += 4;

        const streamingKws = [
            "spotify",
            "apple music",
            "soundcloud",
            "out now",
            "streaming",
            "download",
        ];
        for (const kw of streamingKws) {
            if (description.includes(kw)) {
                score += 2;
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
            if (description.includes(p)) {
                score += 2;
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
            if (description.includes(kw)) {
                score -= 3;
                break;
            }
        }
    }

    // ===========================================================================
    // ADDITIONAL CONTEXT
    // ===========================================================================

    // ALL CAPS long titles are less common in music
    if (title && title === title.toUpperCase() && title.length > 20) score -= 1;

    // ===========================================================================
    // DECISION
    // Threshold: >= 2 → song.
    // Confidence bands help the caller decide whether to invoke LLM fallback:
    //   high   (>= 7): trust the heuristic — skip LLM
    //   medium (2–6):  borderline — consider LLM
    //   low    (< 2):  almost certainly not a song
    // ===========================================================================

    const isSong = score >= 2;
    const confidence = score >= 7 ? "high" : score >= 2 ? "medium" : "low";

    return { isSong, score, confidence };
}
