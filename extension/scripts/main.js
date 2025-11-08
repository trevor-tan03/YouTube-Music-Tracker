let playbackInterval = null;
let isPlaying = false;
let startTime = 0;
let totalListenMs = 0;
let lastSentTime = 0;
const SEND_INTERVAL_MS = 30000; // Send every 30 seconds
let isSong; // undefined = unknown, true = song, false = video
let songButton = null;

function isAdPlaying() {
	return Boolean(document.querySelector("div.ad-showing"));
}

function updateSongButton() {
	if (!songButton) return;

	const button = songButton.querySelector("button");
	if (!button) return;

	if (isSong === undefined) {
		button.textContent = "❓ Unknown";
		button.style.opacity = "0.7";
	} else if (isSong) {
		button.textContent = "🎵 Song";
		button.style.opacity = "1";
	} else {
		button.textContent = "📹 Video";
		button.style.opacity = "1";
	}
}

function addSongButton() {
	// Remove existing button if any
	const existing = document.querySelector("#yt-song-classifier");
	if (existing) {
		existing.remove();
	}

	// Create button structure
	const container = document.createElement("yt-button-view-model");
	container.className = "ytd-menu-renderer";
	container.id = "yt-song-classifier";

	const buttonModel = document.createElement("button-view-model");
	buttonModel.className =
		"ytSpecButtonViewModelHost style-scope ytd-menu-renderer";

	const button = document.createElement("button");
	button.className =
		"yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m yt-spec-button-shape-next--icon-leading";
	button.textContent = "❓ Unknown";
	button.style.transition = "opacity 0.2s";

	button.addEventListener("click", async () => {
		const videoId = getVideoId();
		if (!videoId) {
			console.error("No video ID found");
			return;
		}

		// Show confirmation dialog
		const newState = !Boolean(isSong);
		const confirmed = confirm(
			`Mark this video as: ${
				newState ? "Song" : "Not a Song"
			}?\n\nVideo ID: ${videoId}`
		);

		if (!confirmed) return;

		// Disable button during request
		button.disabled = true;
		button.style.opacity = "0.5";

		try {
			console.log(
				JSON.stringify({
					videoId: videoId,
					isSong: newState,
				})
			);

			const response = await fetch("http://localhost:3000/classify", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					videoId: videoId,
					isSong: newState,
				}),
			});

			if (response.ok) {
				const data = await response.json();
				console.log("Classification updated:", data);
				isSong = newState;
				updateSongButton();
			} else {
				console.error("Classification failed:", await response.text());
				alert("Failed to update classification");
			}
		} catch (error) {
			console.error("Error updating classification:", error);
			alert("Error updating classification");
		} finally {
			button.disabled = false;
			button.style.opacity = "1";
		}
	});

	// Assemble
	buttonModel.appendChild(button);
	container.appendChild(buttonModel);
	songButton = container;

	// Insert into YouTube page
	const target = document.querySelector("#top-level-buttons-computed");
	if (target) {
		target.appendChild(container);
		updateSongButton();
	}
}

function waitForButtons(maxAttempts = 40) {
	return new Promise((resolve, reject) => {
		const checkButton = () => {
			const target = document.querySelector(
				"#top-level-buttons-computed"
			);
			if (target) {
				return target;
			}
			return null;
		};

		// Check immediately
		const existing = checkButton();
		if (existing) {
			return resolve(existing);
		}

		let attempts = 0;
		const interval = setInterval(() => {
			attempts++;
			const target = checkButton();
			if (target) {
				clearInterval(interval);
				resolve(target);
			}
			if (attempts >= maxAttempts) {
				clearInterval(interval);
				reject(
					new Error("Buttons container not found after 10 seconds")
				);
			}
		}, 250);
	});
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

		const currentTotal = isPlaying
			? totalListenMs + (Date.now() - startTime)
			: totalListenMs;

		if (currentTotal - lastSentTime >= SEND_INTERVAL_MS) {
			if (isPlaying) {
				totalListenMs += Date.now() - startTime;
				startTime = Date.now();
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

	// Reset song state for new video
	isSong = null;

	const videoId = getVideoId();
	if (!videoId) {
		console.log("No video ID found, skipping");
		return;
	}

	console.log(`Loading video: ${videoId}`);

	// Add button as soon as buttons container is available
	waitForButtons()
		.then(() => {
			console.log("Buttons container found, adding song button");
			addSongButton();
		})
		.catch((error) => {
			console.error("Failed to add song button:", error);
		});

	// Wait for video metadata to load
	await new Promise((r) => setTimeout(r, 2000));

	try {
		const microformatScript = document.querySelector(
			"#microformat > player-microformat-renderer > script"
		);

		if (!microformatScript) {
			console.error("Microformat script not found");
			return;
		}

		const {
			author: channel,
			name: title,
			description,
			genre,
		} = JSON.parse(microformatScript.innerText);

		const durationEl = document.querySelector(".ytp-time-duration");
		if (!durationEl) {
			console.error("Duration element not found");
			return;
		}

		const durationString = durationEl.innerText.split(":");
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

					// Update isSong state from response
					if (response.data && response.data.isSong !== undefined) {
						isSong = response.data.isSong;
						updateSongButton();
					}

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

		trackPlayback();
	} catch (error) {
		console.error("Error loading video data:", error);
	}
}

let currentVideoId;
let currentSessionId = null;

window.addEventListener("yt-navigate-finish", async () => {
	const newId = getVideoId();

	if (newId && newId !== currentVideoId) {
		console.log("New video detected");
		await onNewVideoLoaded();
		currentVideoId = newId;
	}
});

document.addEventListener("visibilitychange", () => {
	if (document.hidden && totalListenMs > 0) {
		if (isPlaying) {
			totalListenMs += Date.now() - startTime;
			isPlaying = false;
		}
		sendListeningData();
	}
});

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
