let currentView = "top-tracks";
let currentPeriod = "day";
let currentFilter = "all";
let currentSort = "recent";
let currentTracksSearch = ""; // New: search term for top tracks
let allVideos = [];
let allTracks = []; // Tracks for top-tracks view
let filteredVideos = [];
let currentClassifyingVideoId = null;
let isLoadingMore = false;
let hasMoreVideos = true;
let isLoadingMoreTracks = false;
let hasMoreTracks = true;
let currentOffset = 0;
let currentTracksOffset = 0;
const VIDEOS_PER_PAGE = 50;
const TRACKS_PER_PAGE = 50;
let scrollObserver = null;
let videosContainer = null;
let tracksContainer = null;
let tracksScrollObserver = null;

const API_ENDPOINT = "http://localhost:3000";

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupMainTabs();
  setupPeriodTabs();
  setupFilters();
  setupSearch();
  setupTracksSearch(); // New: setup search for top tracks
  setupSort();
  setupModal();
  setupInfiniteScroll();
  setupTracksInfiniteScroll(); // Setup infinite scroll for tracks
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
  document.querySelectorAll(".dashboard-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === view);
  });
  document.querySelectorAll(".dashboard-view").forEach((v) => {
    v.classList.toggle("active", v.id === `${view}-view`);
  });

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
      filters.forEach((f) => f.classList.remove("active"));
      btn.classList.add("active");
      applyFiltersAndSort();
    });
  });
}

// Search for all videos view
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

// New: Search for top tracks view
function setupTracksSearch() {
  const searchInput = document.getElementById("tracks-search-input");
  if (!searchInput) return;

  let debounceTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    currentTracksSearch = e.target.value;
    debounceTimer = setTimeout(() => {
      loadTopTracks();
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

// Setup Modal
function setupModal() {
  const modal = document.getElementById("classification-modal");
  const cancelBtn = document.getElementById("modal-cancel");
  const saveBtn = document.getElementById("modal-save");

  cancelBtn.addEventListener("click", () => {
    closeModal();
  });

  saveBtn.addEventListener("click", () => {
    saveClassification();
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

function openModal(videoId, videoTitle, currentState) {
  currentClassifyingVideoId = videoId;
  const modal = document.getElementById("classification-modal");
  const titleElement = document.getElementById("modal-video-title");

  titleElement.textContent = videoTitle;

  // Set the current classification state
  const radioButtons = document.querySelectorAll(
    'input[name="classification"]',
  );

  radioButtons.forEach((radio) => {
    if (currentState === null) {
      radio.checked = radio.value === "null";
    } else {
      radio.checked = radio.value === String(currentState);
    }
  });

  modal.classList.add("active");
}

function closeModal() {
  const modal = document.getElementById("classification-modal");
  modal.classList.remove("active");
  currentClassifyingVideoId = null;
}

async function saveClassification() {
  const selectedRadio = document.querySelector(
    'input[name="classification"]:checked',
  );

  if (!selectedRadio) {
    alert("Please select a classification");
    return;
  }

  const isSongValue =
    selectedRadio.value === "null" ? null : selectedRadio.value === "true";

  const saveBtn = document.getElementById("modal-save");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const response = await fetch(`${API_ENDPOINT}/classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        videoId: currentClassifyingVideoId,
        isSong: isSongValue,
      }),
    });

    if (!response.ok) {
      throw new Error("Classification failed");
    }

    // Update local data
    const video = allVideos.find(
      (v) => v.videoId === currentClassifyingVideoId,
    );
    if (video) {
      video.isSong = isSongValue;
    }

    // Update UI
    updateCounts();
    applyFiltersAndSort();

    // Reload top tracks if we're on that view
    if (currentView === "top-tracks") {
      loadTopTracks();
    }

    closeModal();
  } catch (error) {
    console.error("Error classifying video:", error);
    alert("Failed to update classification. Please try again.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Classification";
  }
}

// Load top tracks (initial load)
async function loadTopTracks() {
  const container = document.getElementById("tracks-container");
  const statsContainer = document.getElementById("tracks-stats");

  container.innerHTML = '<div class="loading">Loading your top tracks...</div>';
  statsContainer.style.display = "none";

  // Reset pagination
  allTracks = [];
  currentTracksOffset = 0;
  hasMoreTracks = true;

  try {
    await fetchTracks(true);
  } catch (error) {
    console.error("Error loading top tracks:", error);
    container.innerHTML =
      '<div class="empty-state">Failed to load tracks. Please try again.</div>';
  }
}

// Load more tracks (infinite scroll)
async function loadMoreTracks() {
  if (isLoadingMoreTracks || !hasMoreTracks) return;

  isLoadingMoreTracks = true;
  const container = document.getElementById("tracks-container");

  // Add loading indicator
  let loadingIndicator = document.getElementById("loading-more-tracks");
  if (!loadingIndicator) {
    loadingIndicator = document.createElement("div");
    loadingIndicator.id = "loading-more-tracks";
    loadingIndicator.className = "loading";
    loadingIndicator.textContent = "Loading more tracks...";
    loadingIndicator.style.padding = "20px";
    container.appendChild(loadingIndicator);
  }

  try {
    await fetchTracks(false);
  } catch (error) {
    console.error("Error loading more tracks:", error);
  } finally {
    isLoadingMoreTracks = false;
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }
}

// Fetch tracks from API
async function fetchTracks(isInitial) {
  const params = new URLSearchParams({
    classification: "song",
    sortBy: "most-played",
    period: currentPeriod,
    limit: TRACKS_PER_PAGE.toString(),
    offset: currentTracksOffset.toString(),
  });

  // Add search parameter if present
  if (currentTracksSearch) {
    params.append("search", currentTracksSearch);
  }

  const response = await fetch(`${API_ENDPOINT}/videos?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to load tracks");
  }

  const data = await response.json();

  if (isInitial) {
    allTracks = data.videos;
  } else {
    allTracks = [...allTracks, ...data.videos];
  }

  hasMoreTracks = data.pagination.hasMore;
  currentTracksOffset = data.pagination.nextOffset || currentTracksOffset;

  // Update stats (only on initial load or when they change)
  const statsContainer = document.getElementById("tracks-stats");
  if (data.stats) {
    document.getElementById("tracks-count").textContent =
      data.stats.totalVideos || 0;
    document.getElementById("tracks-total-time").textContent = formatTime(
      data.stats.totalListeningTime || 0,
    );
    statsContainer.style.display = "block";
  }

  renderTracks();
}

// Render tracks
function renderTracks() {
  const container = document.getElementById("tracks-container");

  if (!allTracks || allTracks.length === 0) {
    const emptyMessage = currentTracksSearch
      ? `No tracks found matching "${currentTracksSearch}"`
      : "No tracks found for this period";
    container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
    return;
  }

  const tracksHTML = allTracks
    .map(
      (track, index) => `
        <div class="dashboard-track-card">
            <div class="dashboard-track-rank">#${index + 1}</div>
            <img
                src="${`https://i.ytimg.com/vi/${track.id}/maxresdefault.jpg`}"
                alt="${escapeHtml(track.title)}"
                class="dashboard-track-thumbnail"
                loading="lazy"
                data-video-id="${track.id}"
                style="cursor: pointer;"
            />
            <div class="dashboard-track-title">${escapeHtml(track.title)}</div>
            <div class="dashboard-track-channel">${escapeHtml(track.channel)}</div>
            <div class="dashboard-track-stats">
                <span>⏱️ ${formatTime(track.total_listening_time)}</span>
                <span>▶️ ${Math.round(track.total_listening_time / track.duration)} plays</span>
                <button class="setting-btn" data-video-id="${track.id}" data-title="${escapeHtml(track.title)}" data-is-song="${track.is_song}">⚙️</button>
            </div>
        </div>
    `,
    )
    .join("");

  container.innerHTML = tracksHTML;

  // Re-setup infinite scroll observer
  setupTracksInfiniteScroll();

  // Add click handlers for thumbnails
  container.querySelectorAll(".dashboard-track-thumbnail").forEach((thumb) => {
    thumb.addEventListener("click", (e) => {
      e.stopPropagation();
      const videoId = thumb.dataset.videoId;
      openYouTubeVideo(videoId);
    });
  });

  // Add click handlers for settings buttons
  container.querySelectorAll(".setting-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const videoId = btn.dataset.videoId;
      const title = btn.dataset.title;
      const isSong = Boolean(Number(btn.dataset.isSong));
      openModal(videoId, title, isSong);
    });
  });
}

// Setup Infinite Scroll for Tracks
function setupTracksInfiniteScroll() {
  tracksContainer = document.getElementById("tracks-container");

  if (tracksScrollObserver) {
    tracksScrollObserver.disconnect();
  }

  tracksScrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (
          entry.isIntersecting &&
          !isLoadingMoreTracks &&
          hasMoreTracks &&
          currentView === "top-tracks"
        ) {
          loadMoreTracks();
        }
      });
    },
    {
      rootMargin: "100px",
    },
  );

  const sentinel = addTracksSentinelToDOM();
  if (sentinel) {
    tracksScrollObserver.observe(sentinel);
  }
}

function addTracksSentinelToDOM() {
  if (!tracksContainer) return null;

  let sentinel = document.getElementById("tracks-scroll-sentinel");

  if (!sentinel) {
    sentinel = document.createElement("div");
    sentinel.id = "tracks-scroll-sentinel";
    sentinel.style.height = "1px";
    tracksContainer.appendChild(sentinel);
  }

  return sentinel;
}

// Setup Infinite Scroll
function setupInfiniteScroll() {
  videosContainer = document.getElementById("videos-container");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (
          entry.isIntersecting &&
          !isLoadingMore &&
          hasMoreVideos &&
          currentView === "all-videos"
        ) {
          loadMoreVideos();
        }
      });
    },
    {
      rootMargin: "20px",
    },
  );

  const sentinel = addSentinelToDOM();
  observer.observe(sentinel);
}

function addSentinelToDOM() {
  let sentinel = document.getElementById("#scroll-sentinel");

  if (!sentinel) {
    sentinel = document.createElement("div");
    sentinel.id = "scroll-sentinel";
    sentinel.style.height = "1px";
    videosContainer.appendChild(sentinel);
  }

  return sentinel;
}

// Load all videos (initial load)
async function loadAllVideos() {
  const container = document.getElementById("videos-container");
  container.innerHTML = '<div class="loading">Loading videos...</div>';

  // Reset pagination
  allVideos = [];
  currentOffset = 0;
  hasMoreVideos = true;

  try {
    await fetchVideos(true);
  } catch (error) {
    console.error("Error loading videos:", error);
    container.innerHTML =
      '<div class="empty-state">Failed to load videos. Please try again.</div>';
  }
}

// Load more videos (infinite scroll)
async function loadMoreVideos() {
  if (isLoadingMore || !hasMoreVideos) return;

  isLoadingMore = true;
  const container = document.getElementById("videos-container");

  // Add loading indicator
  let loadingIndicator = document.getElementById("loading-more");
  if (!loadingIndicator) {
    loadingIndicator = document.createElement("div");
    loadingIndicator.id = "loading-more";
    loadingIndicator.className = "loading";
    loadingIndicator.textContent = "Loading more videos...";
    loadingIndicator.style.padding = "20px";
    container.appendChild(loadingIndicator);
  }

  try {
    await fetchVideos(false);
  } catch (error) {
    console.error("Error loading more videos:", error);
  } finally {
    isLoadingMore = false;
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }
}

// Fetch videos from API
async function fetchVideos(isInitial) {
  const searchInput = document.getElementById("search-input");
  const searchTerm = searchInput ? searchInput.value : "";

  // Map filter to classification param
  let classificationParam = "";
  if (currentFilter === "songs") {
    classificationParam = "song";
  } else if (currentFilter === "videos") {
    classificationParam = "video";
  }

  const params = new URLSearchParams({
    limit: VIDEOS_PER_PAGE.toString(),
    offset: currentOffset.toString(),
    sortBy: currentSort,
  });

  if (searchTerm) {
    params.append("search", searchTerm);
  }
  if (classificationParam) {
    params.append("classification", classificationParam);
  }

  const response = await fetch(`${API_ENDPOINT}/videos?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Failed to load videos");
  }

  const data = await response.json();

  if (isInitial) {
    allVideos = data.videos;
  } else {
    allVideos = [...allVideos, ...data.videos];
  }

  hasMoreVideos = data.pagination.hasMore;
  currentOffset = data.pagination.nextOffset || currentOffset;

  updateCounts();
  renderVideos();
}

// Update filter counts (now fetches from API)
async function updateCounts() {
  try {
    // Fetch counts for each filter
    const [allRes, songsRes, videosRes] = await Promise.all([
      fetch(`${API_ENDPOINT}/videos?limit=1&offset=0`),
      fetch(`${API_ENDPOINT}/videos?limit=1&offset=0&classification=song`),
      fetch(`${API_ENDPOINT}/videos?limit=1&offset=0&classification=video`),
    ]);

    const [allData, songsData, videosData] = await Promise.all([
      allRes.json(),
      songsRes.json(),
      videosRes.json(),
    ]);

    document.getElementById("count-all").textContent = allData.pagination.total;
    document.getElementById("count-songs").textContent =
      songsData.pagination.total;
    document.getElementById("count-videos").textContent =
      videosData.pagination.total;
  } catch (error) {
    console.error("Error updating counts:", error);
  }
}

// Apply filters and sort (now reloads from API)
function applyFiltersAndSort() {
  // Reset and reload from API
  currentOffset = 0;
  hasMoreVideos = true;
  allVideos = [];

  const container = document.getElementById("videos-container");
  container.innerHTML = '<div class="loading">Loading videos...</div>';

  fetchVideos(true);
}

// Setup persistent scroll observer
function setupScrollObserver() {
  videosContainer = document.getElementById("videos-container");

  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && currentView === "all-videos") {
          console.log("Sentinel visible, loading more...");
          loadMoreVideos();
        }
      });
    },
    {
      root: null,
      rootMargin: "20px",
      threshold: 0.1,
    },
  );

  const sentinel = addSentinelToDOM();
  scrollObserver.observe(sentinel);
}

// Observe the sentinel element
function observeSentinel() {
  const sentinel = document.getElementById("loading-sentinel");
  if (sentinel && scrollObserver) {
    scrollObserver.observe(sentinel);
    console.log("Observing sentinel");
  }
}

// Render videos
function renderVideos() {
  const container = document.getElementById("videos-container");

  if (!allVideos || allVideos.length === 0) {
    container.innerHTML = '<div class="empty-state">No videos found</div>';
    return;
  }

  const videosHTML = allVideos
    .map((video) => {
      const typeEmoji = video.is_song ? "🎵" : "📹";
      const typeLabel = video.is_song ? "Song" : "Video";

      return `
            <div class="dashboard-video-card">
                <div class="video-type-badge" title="${typeLabel}">${typeEmoji}</div>
                <img
                    src="${video.thumbnail_url}"
                    alt="${escapeHtml(video.title)}"
                    class="dashboard-video-thumbnail"
                    data-video-id="${video.id}"
                />
                <div class="dashboard-video-info">
                    <div class="dashboard-video-title" data-video-id="${
                      video.id
                    }">
                        ${escapeHtml(video.title)}
                    </div>
                    <div class="dashboard-video-channel">${escapeHtml(
                      video.channel,
                    )}</div>
                    <div class="dashboard-video-meta">
                        <span>⏱️ ${formatDuration(video.duration)}</span>
                        <span>🎧 ${formatDuration(
                          video.total_listening_time,
                        )}</span>
                        <span>▶️ ${video.play_count ?? 0}</span>
                    </div>
                </div>
                <div class="dashboard-video-actions">
                    <button
                        class="classify-btn"
                        data-video-id="${video.id}"
                        data-video-title="${escapeHtml(video.title)}"
                        data-current-state="${video.is_song}"
                    >
                        🏷️ Classify
                    </button>
                </div>
            </div>
        `;
    })
    .join("");

  // Add loading indicator at the bottom if there are more videos
  const loadingIndicator = hasMoreVideos
    ? '<div id="loading-sentinel" style="height: 100px; display: flex; align-items: center; justify-content: center; color: #d8dee9; opacity: 0.6;">Scroll for more...</div>'
    : '<div style="text-align: center; padding: 20px; color: #d8dee9; opacity: 0.6;">No more videos</div>';

  container.innerHTML = videosHTML;

  setupInfiniteScroll();

  // Re-attach observer to the new sentinel
  if (hasMoreVideos) {
    // Use setTimeout to ensure DOM is updated
    setTimeout(() => {
      observeSentinel();
    }, 0);
  }

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
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const videoId = btn.dataset.videoId;
      const title = btn.dataset.title;
      const isSong = Boolean(Number(btn.dataset.currentState));
      openModal(videoId, title, isSong);
    });
  });
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
      stats.totalListeningTime || 0,
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
