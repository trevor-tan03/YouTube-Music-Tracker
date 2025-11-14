function formatTime(seconds) {
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return `${minutes} min`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMins = minutes % 60;
	return `${hours}h ${remainingMins}m`;
}

function formatDuration(seconds) {
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function createTrackElement(listen, index) {
	const trackItem = document.createElement("div");
	trackItem.className = "track-item";

	trackItem.innerHTML = `
        <div class="track-rank">${index + 1}</div>
        <div>
            <img class="track-thumbnail" src="${listen.thumbnail_url}" alt="${
		listen.title
	}" />
            <div class="track-duration">${formatDuration(listen.duration)}</div>
        </div>
        <div class="track-info">
            <div class="track-title">${listen.title}</div>
            <div class="track-channel">${listen.channel}</div>
            <div class="track-stats">
                <div class="track-time">${formatTime(
					listen.total_listening_time
				)}</div>
            </div>
        </div>
    `;

	trackItem.addEventListener("click", () => {
		window.open(
			`https://www.youtube.com/watch?v=${listen.video_id}`,
			"_blank"
		);
	});

	return trackItem;
}

function getTopListens(period = "all") {
	const container = document.getElementById("tracks-container");

	// Show loading state
	container.innerHTML =
		'<div class="loading">Loading your top tracks...</div>';

	fetch(`http://localhost:3000/top-listens?period=${period}`)
		.then((response) => response.json())
		.then((data) => {
			container.innerHTML = "";

			if (data.length === 0) {
				container.innerHTML =
					'<div class="error">No tracks found for this period.</div>';
				return;
			}

			// Display top 10 tracks
			data.slice(0, 10).forEach((listen, index) => {
				container.appendChild(createTrackElement(listen, index));
			});
		})
		.catch((error) => {
			container.innerHTML =
				'<div class="error">Unable to load tracks. Make sure the server is running.</div>';
			console.error("Error:", error);
		});
}

// Add event listeners to tabs
document.addEventListener("DOMContentLoaded", () => {
	const tabs = document.querySelectorAll(".tab");

	// Open dashboard button
	document.getElementById("open-dashboard").addEventListener("click", () => {
		chrome.tabs.create({
			url: chrome.runtime.getURL("dashboard.html"),
		});
	});

	tabs.forEach((tab) => {
		tab.addEventListener("click", () => {
			// Remove active class from all tabs
			tabs.forEach((t) => t.classList.remove("active"));

			// Add active class to clicked tab
			tab.classList.add("active");

			// Get the period from data attribute
			const period = tab.getAttribute("data-period");

			// Fetch and display tracks for the selected period
			getTopListens(period);
		});
	});

	// Load initial data (all time)
	getTopListens("day");
});
