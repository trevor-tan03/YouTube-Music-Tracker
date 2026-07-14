import OpenAI from "openai";

const openai = new OpenAI({
    baseURL: "http://localhost:1234/v1",
    apiKey: "lm-studio",
});

interface ChannelHistory {
    songCount: number;
    totalCount: number;
    manualOverrides: { title: string; isSong: boolean }[];
    recentSongs: { title: string }[];
}

export async function analyzeWithLLM(
    title: string,
    description: string,
    channel: string,
    genre: string,
) {
    // Try to get 5 songs from the same channel

    // Try to get matches 
}
