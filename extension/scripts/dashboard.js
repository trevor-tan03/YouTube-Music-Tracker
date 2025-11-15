// State
let currentView = "top-tracks";
let currentPeriod = "day";
let currentFilter = "all";
let currentSort = "recent";
let allVideos = [];
let filteredVideos = [];

const API_ENDPOINT = "http://localhost:3000";

// Initialize
document.addEventListener("DOMContentLoaded", () => {
	setupMainTabs();
	setupPeriodTabs();
	setupFilters();
	setupSearch();
	setupSort();

	// Load initial data based on current view
	loadTopTracks();
});

// Main navigation tabs
function setupMainTabs() {
	const tabs = document.querySelectorAll(".dashboard-tab");
	tabs.forEach((tab) => {
		tab.addEventListener("click", () => {
			const view = tab.dataset.view;
			switchView(view);
		});
	});
}

function switchView(view) {
	currentView = view;

	// Update tab styles
	document.querySelectorAll(".dashboard-tab").forEach((tab) => {
		tab.classList.toggle("active", tab.dataset.view === view);
	});

	// Update view visibility
	document.querySelectorAll(".dashboard-view").forEach((v) => {
		v.classList.toggle("active", v.id === `${view}-view`);
	});

	// Load data for the view
	if (view === "top-tracks") {
		loadTopTracks();
	} else if (view === "all-videos") {
		loadAllVideos();
	} else if (view === "stats") {
		loadStatistics();
	}
}

// Period tabs for top tracks
function setupPeriodTabs() {
	const tabs = document.querySelectorAll(".tab[data-period]");
	tabs.forEach((tab) => {
		tab.addEventListener("click", () => {
			currentPeriod = tab.dataset.period;

			// Update active state
			document
				.querySelectorAll(".tab[data-period]")
				.forEach((t) => t.classList.remove("active"));
			tab.classList.add("active");

			loadTopTracks();
		});
	});
}

// Filter buttons
function setupFilters() {
	const filters = document.querySelectorAll(".filter-btn");
	filters.forEach((btn) => {
		btn.addEventListener("click", () => {
			currentFilter = btn.dataset.filter;

			// Update active state
			filters.forEach((f) => f.classList.remove("active"));
			btn.classList.add("active");

			applyFiltersAndSort();
		});
	});
}

// Search
function setupSearch() {
	const searchInput = document.getElementById("search-input");
	if (!searchInput) return;

	let debounceTimer;
	searchInput.addEventListener("input", () => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			applyFiltersAndSort();
		}, 300);
	});
}

// Sort
function setupSort() {
	const sortSelect = document.getElementById("sort-by");
	if (!sortSelect) return;

	sortSelect.addEventListener("change", (e) => {
		currentSort = e.target.value;
		applyFiltersAndSort();
	});
}

// Load top tracks
async function loadTopTracks() {
	const container = document.getElementById("tracks-container");
	container.innerHTML =
		'<div class="loading">Loading your top tracks...</div>';

	try {
		const response = await fetch(
			`${API_ENDPOINT}/top-listens?period=${currentPeriod}`
		);

		if (!response.ok) {
			throw new Error("Failed to load tracks");
		}

		const tracks = await response.json();

		if (tracks.length === 0) {
			container.innerHTML =
				'<div class="empty-state">No tracks found for this period</div>';
			return;
		}

		container.innerHTML = tracks
			.map(
				(track, index) => `
			<div class="dashboard-track-card" data-video-id="${track.video_id}">
				<div class="dashboard-track-rank">#${index + 1}</div>
				<img 
					src="${`https://i.ytimg.com/vi/${track.video_id}/maxresdefault.jpg`}" 
					alt="${escapeHtml(track.title)}"
					class="dashboard-track-thumbnail"
                    loading="lazy"
				/>
				<div class="dashboard-track-title">${escapeHtml(track.title)}</div>
				<div class="dashboard-track-channel">${escapeHtml(track.channel)}</div>
				<div class="dashboard-track-stats">
					<span>⏱️ ${formatTime(track.total_listening_time)}</span>
					<span>▶️ ${Math.round(track.total_listening_time / track.duration)} plays</span>
				</div>
			</div>
		`
			)
			.join("");

		// Add click handlers
		container.querySelectorAll(".dashboard-track-card").forEach((card) => {
			card.addEventListener("click", () => {
				const videoId = card.dataset.videoId;
				openYouTubeVideo(videoId);
			});
		});
	} catch (error) {
		console.error("Error loading top tracks:", error);
		container.innerHTML =
			'<div class="empty-state">Failed to load tracks. Please try again.</div>';
	}
}

// Load all videos
async function loadAllVideos() {
	const container = document.getElementById("videos-container");
	container.innerHTML = '<div class="loading">Loading videos...</div>';

	try {
		const response = await fetch(`${API_ENDPOINT}/videos`);

		if (!response.ok) {
			throw new Error("Failed to load videos");
		}

		allVideos = await response.json();
		updateCounts();
		applyFiltersAndSort();
	} catch (error) {
		console.error("Error loading videos:", error);
		container.innerHTML =
			'<div class="empty-state">Failed to load videos. Please try again.</div>';
	}
}

// Update filter counts
function updateCounts() {
	const counts = {
		all: allVideos.length,
		songs: allVideos.filter((v) => v.isSong === true).length,
		videos: allVideos.filter((v) => v.isSong === false).length,
		unknown: allVideos.filter(
			(v) => v.isSong === null || v.isSong === undefined
		).length,
	};

	document.getElementById("count-all").textContent = counts.all;
	document.getElementById("count-songs").textContent = counts.songs;
	document.getElementById("count-videos").textContent = counts.videos;
	document.getElementById("count-unknown").textContent = counts.unknown;
}

// Apply filters and sort
function applyFiltersAndSort() {
	const searchInput = document.getElementById("search-input");
	const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

	// Filter
	filteredVideos = allVideos.filter((video) => {
		// Search filter
		const matchesSearch =
			!searchTerm ||
			video.title.toLowerCase().includes(searchTerm) ||
			video.channel.toLowerCase().includes(searchTerm);

		if (!matchesSearch) return false;

		// Type filter
		if (currentFilter === "songs") {
			return video.isSong === true;
		} else if (currentFilter === "videos") {
			return video.isSong === false;
		} else if (currentFilter === "unknown") {
			return video.isSong === null || video.isSong === undefined;
		}

		return true; // 'all' filter
	});

	// Sort
	filteredVideos.sort((a, b) => {
		switch (currentSort) {
			case "recent":
				return new Date(b.createdAt) - new Date(a.createdAt);
			case "oldest":
				return new Date(a.createdAt) - new Date(b.createdAt);
			case "most-played":
				return (b.playCount || 0) - (a.playCount || 0);
			case "duration-desc":
				return b.duration - a.duration;
			case "duration-asc":
				return a.duration - b.duration;
			case "title":
				return a.title.localeCompare(b.title);
			default:
				return 0;
		}
	});

	renderVideos();
}

// Render videos
function renderVideos() {
	const container = document.getElementById("videos-container");

	if (filteredVideos.length === 0) {
		container.innerHTML = '<div class="empty-state">No videos found</div>';
		return;
	}

	container.innerHTML = filteredVideos
		.map((video) => {
			const typeEmoji =
				video.isSong === true
					? "🎵"
					: video.isSong === false
					? "📹"
					: "❓";
			const typeLabel =
				video.isSong === true
					? "Song"
					: video.isSong === false
					? "Video"
					: "Unknown";
			const btnClass =
				video.isSong === true
					? "song"
					: video.isSong === false
					? "video"
					: "";
			const btnText =
				video.isSong === true
					? "✓ Song"
					: video.isSong === false
					? "✓ Video"
					: "Classify";

			return `
			<div class="dashboard-video-card">
				<div class="video-type-badge" title="${typeLabel}">${typeEmoji}</div>
				<img 
					src="${video.thumbnailUrl}" 
					alt="${escapeHtml(video.title)}"
					class="dashboard-video-thumbnail"
					data-video-id="${video.videoId}"
				/>
				<div class="dashboard-video-info">
					<div class="dashboard-video-title" data-video-id="${video.videoId}">
						${escapeHtml(video.title)}
					</div>
					<div class="dashboard-video-channel">${escapeHtml(video.channel)}</div>
					<div class="dashboard-video-meta">
						<span>⏱️ ${formatDuration(video.duration)}</span>
						${video.genre ? `<span>🎭 ${escapeHtml(video.genre)}</span>` : ""}
						${video.playCount ? `<span>▶️ ${video.playCount} plays</span>` : ""}
						<span>📅 ${formatDate(video.createdAt)}</span>
					</div>
				</div>
				<div class="dashboard-video-actions">
					<button 
						class="classify-btn ${btnClass}"
						data-video-id="${video.videoId}"
						data-current-state="${video.isSong}"
					>
						${btnText}
					</button>
				</div>
			</div>
		`;
		})
		.join("");

	// Add click handlers for thumbnails and titles
	container
		.querySelectorAll(".dashboard-video-thumbnail, .dashboard-video-title")
		.forEach((el) => {
			el.addEventListener("click", (e) => {
				e.stopPropagation();
				const videoId = el.dataset.videoId;
				openYouTubeVideo(videoId);
			});
		});

	// Add click handlers for classify buttons
	container.querySelectorAll(".classify-btn").forEach((btn) => {
		btn.addEventListener("click", async (e) => {
			e.stopPropagation();
			const videoId = btn.dataset.videoId;
			const currentState =
				btn.dataset.currentState === "true"
					? true
					: btn.dataset.currentState === "false"
					? false
					: null;

			await classifyVideo(videoId, currentState, btn);
		});
	});
}

// Classify video
async function classifyVideo(videoId, currentState, button) {
	// Determine new state (cycle through: null -> true -> false -> null)
	let newState;
	if (currentState === null) {
		newState = true; // Unknown -> Song
	} else if (currentState === true) {
		newState = false; // Song -> Video
	} else {
		newState = null; // Video -> Unknown
	}

	const labels = {
		true: "Song",
		false: "Video",
		null: "Unknown",
	};

	// Confirm with user
	const confirmed = confirm(
		`Mark this video as: ${labels[newState]}?\n\nVideo ID: ${videoId}`
	);

	if (!confirmed) return;

	// Disable button
	button.disabled = true;
	const originalOpacity = button.style.opacity;
	button.style.opacity = "0.5";

	try {
		const response = await fetch(`${API_ENDPOINT}/classify`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				videoId,
				isSong: newState,
			}),
		});

		if (!response.ok) {
			throw new Error("Classification failed");
		}

		// Update local data
		const video = allVideos.find((v) => v.videoId === videoId);
		if (video) {
			video.isSong = newState;
		}

		// Update UI
		updateCounts();
		applyFiltersAndSort();
	} catch (error) {
		console.error("Error classifying video:", error);
		alert("Failed to update classification");
	} finally {
		button.disabled = false;
		button.style.opacity = originalOpacity || "1";
	}
}

// Load statistics
async function loadStatistics() {
	const statsLoading = document.getElementById("stats-loading");
	const statsGrid = document.querySelector(".stats-grid");

	statsLoading.style.display = "block";
	statsGrid.style.display = "none";

	try {
		const response = await fetch(`${API_ENDPOINT}/stats`);

		if (!response.ok) {
			throw new Error("Failed to load statistics");
		}

		const stats = await response.json();

		document.getElementById("stat-total-songs").textContent =
			stats.totalSongs || 0;
		document.getElementById("stat-listening-time").textContent = formatTime(
			stats.totalListeningTime || 0
		);
		document.getElementById("stat-total-plays").textContent =
			stats.totalPlays || 0;
		document.getElementById("stat-total-videos").textContent =
			stats.totalVideos || 0;

		statsLoading.style.display = "none";
		statsGrid.style.display = "grid";
	} catch (error) {
		console.error("Error loading statistics:", error);
		statsLoading.innerHTML =
			'<div class="empty-state">Failed to load statistics</div>';
	}
}

// Helper functions
function openYouTubeVideo(videoId) {
	window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
}

function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function formatTime(seconds) {
	if (!seconds) return "0s";

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	} else if (minutes > 0) {
		return `${minutes}m ${secs}s`;
	} else {
		return `${secs}s`;
	}
}

function formatDuration(seconds) {
	if (!seconds) return "0:00";

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
			.toString()
			.padStart(2, "0")}`;
	}
	return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateString) {
	if (!dateString) return "Unknown";

	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now - date;
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		return "Today";
	} else if (diffDays === 1) {
		return "Yesterday";
	} else if (diffDays < 7) {
		return `${diffDays}d ago`;
	} else if (diffDays < 30) {
		return `${Math.floor(diffDays / 7)}w ago`;
	} else if (diffDays < 365) {
		return `${Math.floor(diffDays / 30)}mo ago`;
	} else {
		return `${Math.floor(diffDays / 365)}y ago`;
	}
}
