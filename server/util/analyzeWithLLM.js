import OpenAI from "openai";
import { validateLLMOutput } from "./checkResponseFormat.js";

// Initialize LM Studio client (uses OpenAI-compatible API)
const lmStudio = new OpenAI({
	baseURL: "http://localhost:1234/v1", // LM Studio default port
	apiKey: "lm-studio", // LM Studio doesn't require a real API key
});

export async function analyzeWithLLM(
	videoId,
	info,
	title,
	channel,
	description,
	thumbnailUrl
) {
	// Prepare the prompt for the LLM
	const prompt = `Analyze this YouTube video and determine if it's a song/music content.
  
  Video Title: ${title}
  Other Info: ${info}
  Channel Name: ${channel}
  Description: ${description || "No description provided"}
  
  When extracting the artist:
  - Look for names which are repeated often
  - Check the hashtags in the Other Info
  - Consider the channel name

  Please respond in JSON format with the following structure:
  {
    "isSong": number (0|1),
    "confidence": number (0-1),
    "reasoning": "brief explanation",
    "extractedTitle": "the song title if it's a song, or null",
    "extractedArtist": "the artist/band name if it's a song, or null",
    "videoType": "one of: music_video, live_performance, cover, lyric_video, audio, official_audio, remix, or null if not a song"
  }
  
  Consider it a song if it's:
  - An official music video
  - A live performance of a song
  - A cover version
  - A lyric video
  - An audio-only upload of a song
  - A remix or alternate version
  
  NOT a song if it's:
  - A podcast
  - A tutorial/educational video
  - A vlog
  - Commentary/review video
  - Trailer or movie clip
  - Gaming content
  - Just background music in non-music content
  - Doesn't include both an artist name and song title`;

	// Call the LLM API
	const model = "liquid/lfm2-1.2b";
	const completion = await lmStudio.chat.completions.create({
		model: "local-model", // LM Studio uses whatever model is loaded
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
