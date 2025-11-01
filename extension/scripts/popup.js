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
					listen.listening_time
				)}</div>
            </div>
        </div>
    `;

	trackItem.addEventListener("click", () => {
		window.open(`https://www.youtube.com/watch?v=${listen.id}`, "_blank");
	});

	return trackItem;
}

function getTopListens() {
	const container = document.getElementById("tracks-container");

	fetch("http://localhost:3000/top-listens")
		.then((response) => response.json())
		.then((data) => {
			container.innerHTML = "";
			data.forEach((listen, index) => {
				container.appendChild(createTrackElement(listen, index));
			});
		})
		.catch((error) => {
			container.innerHTML =
				'<div class="error">Unable to load tracks. Make sure the server is running.</div>';
			console.error("Error:", error);
		});
}

getTopListens();
