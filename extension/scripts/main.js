let playbackInterval = null;
let isPlaying = false;
let startTime = 0;
let totalListenMs = 0;
const SEND_INTERVAL_MS = 30000; // kept for reference, heartbeat now lives in background.js
let isSong; // undefined = unknown, true = song, false = video
let songButton = null;
let videoDetails = null;

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
            }?\n\nVideo ID: ${videoId}`,
        );

        if (!confirmed) return;

        // Disable button during request
        button.disabled = true;
        button.style.opacity = "0.5";

        try {
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
                "#top-level-buttons-computed",
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
                    new Error("Buttons container not found after 10 seconds"),
                );
            }
        }, 250);
    });
}

// ─── Playback tracking (local only — background.js owns the heartbeat) ────────
//
// The content script still monitors the video element so it can:
//   1. Keep a local totalListenMs for the beforeunload flush
//   2. Detect ad state (background can't see the DOM)
//
// NOTE: pause/resume triggered by tab audibility is handled by background.js
// via chrome.tabs.onUpdated. The content script does NOT send periodic listen
// messages anymore.

function trackPlayback() {
    const video = document.querySelector("video");
    if (!video) return;

    isPlaying = false;
    startTime = 0;
    totalListenMs = 0;

    const endedHandler = () => {
        if (isPlaying) {
            totalListenMs += Date.now() - startTime;
            isPlaying = false;
        }
    };
    video.addEventListener("ended", endedHandler);

    if (playbackInterval) {
        clearInterval(playbackInterval);
    }

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
                ).toFixed(1)}s`,
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
        `🛑 Stopped tracking video ${currentVideoId} — total listen time: ${(totalListenMs / 1000).toFixed(1)}s`,
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
    if (currentVideoId) {
        stopTracking();
    }

    // Reset state for new video
    isSong = null;
    totalListenMs = 0;
    currentSessionId = null;

    const videoId = getVideoId();
    if (!videoId) {
        console.log("No video ID found, skipping");
        return;
    }

    console.log(`Loading video: ${videoId}`);

    // Add button as soon as buttons container is available
    waitForButtons()
        .then(() => {
            addSongButton();
        })
        .catch((error) => {
            console.error("Failed to add song button:", error);
        });

    // Wait for video metadata to load
    await new Promise((r) => setTimeout(r, 2000));

    try {
        const microformatScript = document.querySelector(
            "#microformat > player-microformat-renderer > script",
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
            thumbnailUrl,
        } = JSON.parse(microformatScript.innerText);

        videoDetails = { title, channel, description, genre, thumbnailUrl };

        const durationEl = document.querySelector(".ytp-time-duration");
        if (!durationEl) {
            console.error("Duration element not found");
            return;
        }

        function parseDurationText(text) {
            if (!text || typeof text !== "string") return 0;
            const cleaned = text.trim().replace(/[^0-9:]/g, "");
            const parts = cleaned.split(":").map((p) => parseInt(p, 10) || 0);
            if (parts.length === 1) {
                return parts[0];
            } else if (parts.length === 2) {
                return parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
                return parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else {
                let seconds = 0;
                let multiplier = 1;
                for (let i = parts.length - 1; i >= 0; i--) {
                    seconds += parts[i] * multiplier;
                    multiplier *= 60;
                }
                return seconds;
            }
        }

        const durationText = durationEl.textContent || durationEl.innerText;
        const duration = parseDurationText(durationText);

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
                        chrome.runtime.lastError.message,
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
                }

                console.log(response.data);

                if (response.data && response.data.isSong !== undefined) {
                    isSong = response.data.isSong;
                    updateSongButton();
                }

                // Store sessionId locally only for the beforeunload flush.
                // background.js also stores it keyed by tabId for the heartbeat.
                if (response.data && response.data.sessionId) {
                    currentSessionId = response.data.sessionId;
                    console.log(`Session ID: ${currentSessionId}`);
                } else {
                    currentSessionId = null;
                }
            },
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
        currentVideoId = newId;
        await onNewVideoLoaded();

        chrome.runtime.sendMessage({
            type: "currentVideo",
            video: videoDetails,
        });
    }
});

// visibilitychange: no longer sends a listen update — background.js handles
// timing. We just log for debugging.
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        console.log(
            `👁️ Tab hidden — background.js will handle pause via audible change`,
        );
    }
});

// beforeunload: send one final flush so nothing is lost between the last
// heartbeat and the tab closing. background.js will also fire onRemoved
// shortly after, but that races with the server so we belt-and-suspenders here.
window.addEventListener("beforeunload", () => {
    if (isPlaying) {
        totalListenMs += Date.now() - startTime;
        isPlaying = false;
    }

    console.log(
        `currentVideoId: ${currentVideoId}\ntotalListenTime: ${(totalListenMs / 1000).toFixed(1)}s`,
    );

    if (!currentSessionId || totalListenMs === 0) return;

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
