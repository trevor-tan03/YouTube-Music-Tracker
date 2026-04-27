import OpenAI from "openai";
import { validateLLMOutput } from "./checkResponseFormat.js";

// Initialize LM Studio client (uses OpenAI-compatible API)
const lmStudio = new OpenAI({
    baseURL: "http://localhost:1234/v1", // LM Studio default port
    apiKey: "lm-studio", // LM Studio doesn't require a real API key
});

export async function analyzeWithLLM(title, channel, description, genre) {
    // Prepare the prompt for the LLM
    const prompt = `
You are a strict classifier. Your primary goal is to correctly say "NOT a song" when evidence is insufficient.

Step 1: Decide if this video is a song.
Only classify as a song if there is CLEAR evidence of:
- A specific song title AND
- A specific artist/band name AND
- The content is primarily music-focused

If ANY of the above is missing or uncertain, classify it as NOT a song.

Step 2: ONLY IF it is a song, extract details.

Video information:
- Title: ${title}
- Genre: ${genre}
- Channel Name: ${channel}
- Description: ${description || "No description provided"}

Disqualifying signals (any of these => NOT a song):
- Podcast, interview, vlog, tutorial, commentary, review
- Gaming or stream content
- Background music only
- Ambiguous titles like "chill beats", "music to study to"
- No clearly identifiable artist AND song title
- The channel is not an artist or music-related channel

Valid song types:
- official music video
- live performance
- cover
- lyric video
- audio-only song
- remix

Respond ONLY in JSON:

{
  "isSong": boolean,
  "confidence": number (0–1),
  "reasoning": "short justification",
  "extractedTitle": string | null,
  "extractedArtist": string | null,
  "videoType": "music_video" | "live_performance" | "cover" | "lyric_video" | "audio" | "official_audio" | "remix" | null
}

Rules:
- If isSong is false, extractedTitle, extractedArtist, and videoType MUST be null.
- Do NOT guess artist or title.
- When uncertain, choose isSong = false.
`;

    // Call the LLM API
    const completion = await lmStudio.chat.completions.create({
        model: "meta-llama-3.1-8b-instruct", // LM Studio uses whatever model is loaded
        messages: [
            {
                role: "system",
                content:
                    "You are a music classification assistant. Respond only with valid JSON.",
            },
            {
                role: "user",
                content: prompt,
            },
        ],
        temperature: 0.3, // Lower temperature for more consistent output
        max_tokens: 500,
    });

    // Parse the LLM response
    const responseText = completion.choices[0].message.content;
    const result = validateLLMOutput(responseText);
    return result;
}
