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
}
