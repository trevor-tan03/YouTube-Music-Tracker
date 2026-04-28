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

async function getChannelHistory(channel: string): Promise<ChannelHistory> {}
