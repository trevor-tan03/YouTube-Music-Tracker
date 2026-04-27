import OpenAI from "openai";
import { db } from "../database/database.js";
import type {
    ClassificationResult,
    ClassificationSignal,
} from "./classificationResult.js";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface ChannelHistory {
    songCount: number;
    totalCount: number;
    manualOverrides: { title: string; isSong: boolean }[];
    recentSongs: { title: string }[];
}

async function getChannelHistory(channel: string): Promise<ChannelHistory> {
    // Pull the last 20 classified videos from this channel
    const videos = await db
        .selectFrom("video as v")
        .innerJoin(
            "video_song_classification_history as h",
            "h.video_id",
            "v.id",
        )
        .select(["v.title", "v.is_song", "h.type"])
        .where("v.channel", "=", channel)
        .orderBy("h.classified_at", "desc")
        .limit(20)
        .execute();

    const songCount = videos.filter((v) => v.is_song).length;

    // Manual overrides are the most valuable context — surface them explicitly
    const manualOverrides = videos
        .filter((v) => v.type === "manual")
        .slice(0, 5)
        .map((v) => ({ title: v.title, isSong: Boolean(v.is_song) }));

    const recentSongs = videos
        .filter((v) => v.is_song)
        .slice(0, 5)
        .map((v) => ({ title: v.title }));

    return {
        songCount,
        totalCount: videos.length,
        manualOverrides,
        recentSongs,
    };
}

async function getPriorClassifications(videoId: string) {
    return db
        .selectFrom("video_song_classification_history")
        .select(["is_song", "type", "reason", "classified_at"])
        .where("video_id", "=", videoId)
        .orderBy("classified_at", "desc")
        .execute();
}

function buildChannelContextBlock(history: ChannelHistory): string {
    if (history.totalCount === 0) {
        return "Channel history: No prior videos from this channel in watch history.";
    }

    const lines = [
        `Channel history (${history.songCount}/${history.totalCount} recent videos are songs):`,
    ];

    if (history.manualOverrides.length > 0) {
        lines.push("Manual corrections for this channel (high confidence):");
        for (const o of history.manualOverrides) {
            lines.push(
                `  • "${o.title}" → ${o.isSong ? "IS a song" : "NOT a song"}`,
            );
        }
    }

    if (history.recentSongs.length > 0) {
        lines.push("Recent songs from this channel:");
        for (const s of history.recentSongs) {
            lines.push(`  • "${s.title}"`);
        }
    }

    return lines.join("\n");
}

function buildPriorClassificationsBlock(
    priors: Awaited<ReturnType<typeof getPriorClassifications>>,
): string {
    if (priors.length === 0) return "";

    const lines = ["Prior classifications of this exact video:"];
    for (const p of priors) {
        const date = new Date(p.classified_at).toLocaleDateString();
        lines.push(
            `  • ${p.type} on ${date}: ${p.is_song ? "IS a song" : "NOT a song"}${p.reason ? ` — "${p.reason}"` : ""}`,
        );
    }

    // Flag manual overrides as especially significant
    if (priors.some((p) => p.type === "manual")) {
        lines.push(
            "⚠ A human has manually classified this video — weight this heavily.",
        );
    }

    return lines.join("\n");
}

export async function analyzeWithLLM(
    videoId: string,
    title: string,
    channel: string,
    description: string,
    duration: number,
    genre: string,
): Promise<ClassificationResult | null> {
    const [channelHistory, priorClassifications] = await Promise.all([
        getChannelHistory(channel),
        getPriorClassifications(videoId),
    ]);

    const channelContextBlock = buildChannelContextBlock(channelHistory);
    const priorClassificationsBlock =
        buildPriorClassificationsBlock(priorClassifications);

    const mm = Math.floor(duration / 60);
    const ss = String(duration % 60).padStart(2, "0");

    const prompt = `You are a strict classifier determining whether a YouTube video is a song.

Your primary goal is to correctly say "NOT a song" when evidence is insufficient.

Only classify as a song if there is CLEAR evidence of ALL of the following:
- A specific song title
- A specific artist/band name
- The content is primarily music-focused

If ANY of the above is missing or uncertain, classify it as NOT a song.

---

Video details:
- Title: ${title}
- Channel: ${channel}
- Genre: ${genre || "unknown"}
- Duration: ${mm}:${ss} (${duration}s)
- Description: ${description || "No description provided"}

${channelContextBlock}
${priorClassificationsBlock ? `\n${priorClassificationsBlock}` : ""}

---

Disqualifying signals (any of these → NOT a song):
- Podcast, interview, vlog, tutorial, commentary, review
- Gaming or stream content
- Background/ambient music only (lo-fi, study beats etc.)
- Ambiguous titles like "chill beats" or "music to study to"
- No clearly identifiable artist AND song title
- Full concert recordings or playlists

Valid song types:
- Official music video or audio
- Live performance of a specific song
- Cover of a specific song
- Lyric video / audio-only song
- Remix

---

Respond ONLY with valid JSON — no extra text, no markdown:

{
  "isSong": boolean,
  "confidence": "low" | "medium" | "high",
  "score": number (0–100, where 50 = uncertain),
  "reason": "one sentence justification",
  "signals": [
    { "field": "title" | "channel" | "duration" | "description" | "genre" | "history", "signal": "description of what you observed", "score": number (-10 to +10) }
  ],
  "extractedTitle": string | null,
  "extractedArtist": string | null,
  "videoType": "music_video" | "live_performance" | "cover" | "lyric_video" | "audio" | "official_audio" | "remix" | null
}

Rules:
- If isSong is false, extractedTitle, extractedArtist, and videoType MUST be null
- Do NOT guess artist or title — only extract if clearly stated in title or description
- When uncertain, choose isSong = false
- Include 3–6 signals covering the most significant evidence either way`;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a music classification assistant. Respond only with valid JSON.",
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 500,
            response_format: { type: "json_object" },
        });

        const responseText = completion?.choices[0]?.message.content;
        if (!responseText) return null;

        const parsed = JSON.parse(responseText);
        if (typeof parsed.isSong !== "boolean") return null;

        const signals: ClassificationSignal[] = (parsed.signals ?? []).map(
            (s: { field: string; signal: string; score: number }) => ({
                field: s.field as ClassificationSignal["field"],
                signal: s.signal,
                score: s.score,
            }),
        );

        // Normalise LLM's 0–100 score to the same rough scale as the heuristic
        const normalisedScore = Math.round((parsed.score - 50) / 10);

        const topSignals = [...signals]
            .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
            .slice(0, 3)
            .map((s) => `${s.signal} (${s.score > 0 ? "+" : ""}${s.score})`)
            .join(", ");

        return {
            isSong: parsed.isSong,
            confidence: parsed.confidence ?? "low",
            score: normalisedScore,
            signals,
            reason: parsed.reason ?? topSignals ?? "No reason provided",
            type: "llm",
        };
    } catch (err) {
        console.error("LLM analysis failed:", err);
        return null;
    }
}
