let playbackInterval = null;
let isPlaying = false;
let startTime = 0;
let totalListenMs = 0;

function trackPlayback() {
	const video = document.querySelector("video");
	if (!video) return;

	isPlaying = false;
	startTime = 0;
	totalListenMs = 0;

	playbackInterval = setInterval(() => {
		const nowPlaying = !video.paused && !video.ended;
		if (nowPlaying && !isPlaying) {
			startTime = Date.now();
			isPlaying = true;
		} else if (!nowPlaying && isPlaying) {
			totalListenMs += Date.now() - startTime;
			isPlaying = false;
			console.log(
				`⏸️ Paused — total listening time: ${(
					totalListenMs / 1000
				).toFixed(1)}s`
			);
		}
	}, 1000);
}

function stopTracking() {
	if (isPlaying) {
		totalListenMs += Date.now() - startTime;
		isPlaying = false;
	}

	console.log(
		`🛑 Stopped tracking video ${currentVideoId} — total listen time: ${(
			totalListenMs / 1000
		).toFixed(1)}s`
	);

	if (playbackInterval) {
		clearInterval(playbackInterval);
		playbackInterval = null;
	}
}

function getVideoId() {
	const url = new URL(window.location.href);
	return url.searchParams.get("v");
}

function onNewVideoLoaded() {
	if (isPlaying) {
		stopTracking();
	}

	const getDescriptionFromJSONLD = () => {
		const scriptTag = document.querySelector(
			'script[type="application/ld+json"]'
		);
		if (scriptTag) {
			try {
				const data = JSON.parse(scriptTag.textContent);
				return data.description || "";
			} catch (e) {
				console.error("Error parsing JSON-LD:", e);
				return "";
			}
		}
		return "";
	};

	const extractJsonObject = (text) => {
		if (!text || typeof text !== "string") return null;
		let body = text.trim();
		const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
		if (fenced && fenced[1]) {
			body = fenced[1].trim();
		}
		try {
			return JSON.parse(body);
		} catch (_) {
			return null;
		}
	};

	let timeout = setTimeout(async () => {
		const { isSong, details } = getSongInfo();
		if (isSong) return;

		const url = "http://localhost:1234/v1/chat/completions";

		const title = document.title.replace(" - YouTube", "");
		const channel = document
			.querySelector("#owner")
			.innerText.split("\n")[0];
		const description = getDescriptionFromJSONLD();

		const payload = {
			model: "liquid/lfm2-1.2b",
			messages: [
				{
					role: "system",
					content: `You are a classifier that determines if a YouTube video is a song or music video based on the video title and description.
                    IMPORTANT:
                        - DO NOT include music reactions
                        - DO NOT include anime fights with music
                        - DO NOT include parodies
                        - Please look at both the title and description before coming to a conclusion
                        Respond with a JSON object {"isSong": true|false, "artist": string, "song": string}.`,
				},
				{
					role: "user",
					content: `Title: ${title}\nChannel: ${channel}\nDescription: ${description}`,
				},
			],
			temperature: 0.2,
		};

		chrome.runtime.sendMessage(
			{
				type: "classifyVideo",
				url,
				payload,
			},
			(response) => {
				if (!response) {
					console.error("No response from background script");
					return;
				}
				if (!response.ok) {
					console.error("Classification request failed:", response);
					return;
				}
				const messageContent =
					response.data?.choices?.[0]?.message?.content || "";
				const parsed = extractJsonObject(messageContent);
				if (!parsed) {
					console.warn(
						"Could not parse classifier response. Raw:",
						messageContent
					);
					return;
				}
				console.log("Classification:", {
					isSong: parsed.isSong,
					artist: parsed.artist,
					song: parsed.song,
				});
			}
		);
	}, 3000);

	// Start checking playback or getting song info
	trackPlayback();
}

function getSongInfo() {
	let isSong = false;
	let song = {};

	try {
		song.title = document.querySelector(
			".yt-video-attribute-view-model__title"
		).innerText;
		song.artist = document.querySelector(
			".yt-video-attribute-view-model__subtitle"
		).innerText;
		song.album = document.querySelector(
			".yt-video-attribute-view-model__secondary-subtitle"
		).innerText;
		song.cover = document.querySelector(
			".yt-video-attribute-view-model__hero-image"
		).src;

		// Send the song info to web server
		console.log(`🎧 Playing: ${song.artist} - ${song.title}`);
		isSong = true;
	} catch (error) {
		console.log("Could not find song from description");
	}

	return {
		isSong,
		song,
	};
}

let currentVideoId;
let timeoutId;

window.addEventListener("yt-navigate-finish", () => {
	const newId = getVideoId();

	if (newId && newId !== currentVideoId) {
		console.log("New video detected");
		onNewVideoLoaded();
		currentVideoId = newId;
	}
});
