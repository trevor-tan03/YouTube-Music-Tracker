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

	// Start checking playback or getting song info
	trackPlayback();
}

// function checkIfVideoIsSong() {
// 	// Check meta tag
// 	const category = document.querySelector('meta[itemprop="genre"]')?.content;
// 	if (category === "Music") return true;

// 	// Check if title or description for keywords found in videos for songs
// 	const keywords = ["lyrics", "performance", "cover", "mv"];
// 	return false;
// }

function getSongInfo() {
	try {
		const songTitle = document.querySelector(
			".yt-video-attribute-view-model__title"
		).innerText;
		const songArtist = document.querySelector(
			".yt-video-attribute-view-model__subtitle"
		).innerText;
		const songAlbum = document.querySelector(
			".yt-video-attribute-view-model__secondary-subtitle"
		).innerText;
		const songAlbumCover = document.querySelector(
			".yt-video-attribute-view-model__hero-image"
		).src;

		// Send the song info to web server
		console.log(`🎧 Playing: ${songArtist} - ${songTitle}`);
	} catch (error) {
		console.log("Could not find song from description");
	}
}

let currentVideoId;
let timeoutId;

window.addEventListener("yt-navigate-finish", () => {
	const newId = getVideoId();

	if (newId && newId !== currentVideoId) {
		console.log("New video detected");
		onNewVideoLoaded();
		currentVideoId = newId;

		// Wait a few seconds to ensure DOM updates
		setTimeout(getSongInfo, 3000);
	}
});
