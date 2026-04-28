export interface ClassificationSignal {
    field:
        | "genre"
        | "duration"
        | "channel"
        | "title"
        | "description"
        | "history";
    signal: string;
    score: number;
}

export interface ClassificationResult {
    isSong: boolean;
    confidence: "low" | "medium" | "high";
    score: number;
    signals: ClassificationSignal[];
    reason: string;
    type: "heuristic" | "llm" | "manual";
    // Only populated by LLM when isSong is true — used for artist matching
    extractedTitle: string | null;
    extractedArtist: string | null;
    videoType:
        | "music_video"
        | "live_performance"
        | "cover"
        | "lyric_video"
        | "audio"
        | "official_audio"
        | "remix"
        | null;
}
