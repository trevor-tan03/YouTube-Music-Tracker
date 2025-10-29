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

async function onNewVideoLoaded() {
	if (isPlaying) {
		stopTracking();
	}

	const url = "http://localhost:3000/analyse";

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
			.querySelector("#expanded")
			.innerText.trim();
		return description;
	}

	// Wait for video page to load fully
	await new Promise((r) => setTimeout(r, 5000));

	const videoId = getVideoId();
	const info = document.querySelector("#info-container").innerText;
	const title = document.title.replace(" - YouTube", "");
	const channel =
		document.querySelector("#owner")?.innerText.split("\n")[0] || "";
	const description = await getDescription();
	document.querySelector("#expand").click(); // collapse the description

	const payload = {
		title,
		info,
		channel,
		description,
		videoId,
		thumbnailUrl: `https://img.youtube.com/vi/${videoId}/default.jpg`,
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
			} else {
				console.log(response.json());
			}
		}
	);

	// Start checking playback or getting song info
	trackPlayback();
}

let currentVideoId;
let timeoutId;

window.addEventListener("yt-navigate-finish", async () => {
	const newId = getVideoId();

	if (newId && newId !== currentVideoId) {
		console.log("New video detected");
		await onNewVideoLoaded();
		currentVideoId = newId;
	}
});
