let playbackInterval = null;
let isPlaying = false;
let startTime = 0;
let totalListenMs = 0;
let lastSentTime = 0;
const SEND_INTERVAL_MS = 30000; // Send every 30 seconds

function isAdPlaying() {
	return Boolean(document.querySelector("div.ad-showing"));
}

function sendListeningData() {
	if (!currentSessionId || totalListenMs === 0) return;

	const listeningTime = (totalListenMs / 1000).toFixed(1);
	console.log(`📊 Sending listening update: ${listeningTime}s`);

	try {
		chrome.runtime.sendMessage(
			{
				type: "listen",
				sessionId: currentSessionId,
				listeningTime,
			},
			(response) => {
				if (chrome.runtime.lastError) {
					console.error(
						"Extension context invalidated:",
						chrome.runtime.lastError.message
					);
					// Stop trying to send messages
					if (playbackInterval) {
						clearInterval(playbackInterval);
						playbackInterval = null;
					}
					return;
				}
				if (!response) {
					console.error("No response from background script");
					return;
				}
				if (!response.ok) {
					console.error("Listening request failed:", response);
				} else {
					console.log(response.data);
				}
			}
		);
	} catch (error) {
		console.error("Failed to send message:", error);
		// Stop the interval to prevent repeated errors
		if (playbackInterval) {
			clearInterval(playbackInterval);
			playbackInterval = null;
		}
	}
}

function trackPlayback() {
	const video = document.querySelector("video");
	if (!video) return;

	isPlaying = false;
	startTime = 0;
	totalListenMs = 0;
	lastSentTime = 0;

	// Send data when video ends
	const endedHandler = () => {
		if (isPlaying) {
			totalListenMs += Date.now() - startTime;
			isPlaying = false;
		}
		if (totalListenMs > 0) {
			sendListeningData();
		}
	};
	video.addEventListener("ended", endedHandler);

	playbackInterval = setInterval(() => {
		const nowPlaying = !video.paused && !video.ended && !isAdPlaying();
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

		// Send data periodically during playback
		// Calculate current total including ongoing playback
		const currentTotal = isPlaying
			? totalListenMs + (Date.now() - startTime)
			: totalListenMs;

		if (currentTotal - lastSentTime >= SEND_INTERVAL_MS) {
			// Update totalListenMs if currently playing
			if (isPlaying) {
				totalListenMs += Date.now() - startTime;
				startTime = Date.now(); // Reset start time
			}
			sendListeningData();
			lastSentTime = totalListenMs;
		}
	}, 1000);
}

async function stopTracking() {
	if (isPlaying) {
		totalListenMs += Date.now() - startTime;
		isPlaying = false;
	}

	const listeningTime = (totalListenMs / 1000).toFixed(1);
	console.log(
		`🛑 Stopped tracking video ${currentVideoId} — total listen time: ${listeningTime}s`
	);

	sendListeningData();

	if (playbackInterval) {
		clearInterval(playbackInterval);
		playbackInterval = null;
	}
}

function getVideoId() {
	const url = new URL(window.location.href);
	return url.searchParams.get("v");
}

async function onNewVideoLoaded() {
	if (isPlaying) {
		stopTracking();
	}

	function waitForElement(selector, timeout = 10000) {
		return new Promise((resolve, reject) => {
			const interval = setInterval(() => {
				const el = document.querySelector(selector);
				if (el) {
					clearInterval(interval);
					resolve(el);
				}
			}, 200);
			setTimeout(() => {
				clearInterval(interval);
				reject(new Error(`Timeout: ${selector} not found`));
			}, timeout);
		});
	}

	async function getDescription() {
		const expandBtn = await waitForElement("#expand");
		expandBtn.click();
		await new Promise((r) => setTimeout(r, 1000)); // wait for it to expand
		const description = document
			.querySelector("#expanded.style-scope.ytd-text-inline-expander")
			.innerText.trim();
		return description;
	}

	// Wait for video page to load fully
	await new Promise((r) => setTimeout(r, 5000));

	const videoId = getVideoId();
	const {
		author: channel,
		// thumbnailUrl, // -- this gives the 1280x720 thumbmnail, but I want the 120x90 thumbnail
		name: title,
		description,
		genre,
	} = JSON.parse(
		document.querySelector(
			"#microformat > player-microformat-renderer > script"
		).innerText
	);
	const durationString = document
		.querySelector(".ytp-time-duration")
		.innerText.split(":");
	const duration =
		Number.parseInt(durationString[0]) * 60 +
		Number.parseInt(durationString[1]);

	const payload = {
		title,
		channel,
		description,
		videoId,
		thumbnailUrl: `https://img.youtube.com/vi/${videoId}/default.jpg`,
		duration,
		genre,
	};

	try {
		chrome.runtime.sendMessage(
			{
				type: "analyse",
				payload,
			},
			(response) => {
				if (chrome.runtime.lastError) {
					console.error(
						"Extension context invalidated:",
						chrome.runtime.lastError.message
					);
					return;
				}
				if (!response) {
					console.error("No response from background script");
					return;
				}
				if (!response.ok) {
					console.error("Classification request failed:", response);
					return;
				} else {
					console.log(response.data);
					// Store the session ID if provided
					if (response.data && response.data.sessionId) {
						currentSessionId = response.data.sessionId;
						console.log(`Session ID: ${currentSessionId}`);
					} else {
						currentSessionId = null;
					}
				}
			}
		);
	} catch (error) {
		console.error("Failed to send analyse message:", error);
	}

	// Start checking playback or getting song info
	trackPlayback();
}

let currentVideoId;
let currentSessionId = null;
let timeoutId;

window.addEventListener("yt-navigate-finish", async () => {
	const newId = getVideoId();

	if (newId && newId !== currentVideoId) {
		console.log("New video detected");
		await onNewVideoLoaded();
		currentVideoId = newId;
	}
});

// Use visibilitychange instead of beforeunload (more reliable)
document.addEventListener("visibilitychange", () => {
	if (document.hidden && totalListenMs > 0) {
		// Tab is being hidden - send data now
		if (isPlaying) {
			totalListenMs += Date.now() - startTime;
			isPlaying = false;
		}
		sendListeningData();
	}
});

// Keep beforeunload as backup
window.addEventListener("beforeunload", (e) => {
	if (isPlaying) {
		totalListenMs += Date.now() - startTime;
		isPlaying = false;
	}

	console.log(
		`currentVideoId: ${currentVideoId}\ntotalListenTime: ${
			totalListenMs / 1000
		}s`
	);
	if (!currentVideoId || totalListenMs === 0) return;

	try {
		chrome.runtime.sendMessage({
			type: "listen",
			sessionId: currentSessionId,
			listeningTime: (totalListenMs / 1000).toFixed(1),
		});
	} catch (error) {
		console.error("Failed to send beforeunload message:", error);
	}
});
