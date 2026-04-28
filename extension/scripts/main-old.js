let playbackInterval = null;
let isPlaying = false;
let startTime = 0;
let totalListenMs = 0;
let currentVideoId;
let currentSessionId = null;

function isAdPlaying() {
    return Boolean(document.querySelector("div.ad-showing"));
}

function trackPlayback() {
    const video = document.querySelector("video");
    if (!video) return;

    isPlaying = false;
    startTime = 0;
    totalListenMs = 0;

    video.addEventListener("ended", () => {
        if (isPlaying) {
            totalListenMs += Date.now() - startTime;
            isPlaying = false;
        }
    });

    if (playbackInterval) clearInterval(playbackInterval);

    playbackInterval = setInterval(() => {
        const nowPlaying = !video.paused && !video.ended && !isAdPlaying();
        if (nowPlaying && !isPlaying) {
            startTime = Date.now();
            isPlaying = true;
        } else if (!nowPlaying && isPlaying) {
            totalListenMs += Date.now() - startTime;
            isPlaying = false;
        }
    }, 1000);
}

function stopTracking() {
    if (isPlaying) {
        totalListenMs += Date.now() - startTime;
        isPlaying = false;
    }
    if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
}

function getVideoId() {
    return new URL(window.location.href).searchParams.get("v");
}

async function onNewVideoLoaded() {
    if (currentVideoId) stopTracking();

    totalListenMs = 0;
    currentSessionId = null;

    chrome.runtime.sendMessage({ type: "clearCurrentVideo" });

    const videoId = getVideoId();
    if (!videoId) return;

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

        const durationEl = document.querySelector(".ytp-time-duration");
        if (!durationEl) {
            console.error("Duration element not found");
            return;
        }

        function parseDurationText(text) {
            const parts = text
                .trim()
                .replace(/[^0-9:]/g, "")
                .split(":")
                .map(Number);
            return parts.reduce((acc, val) => acc * 60 + val, 0);
        }

        const duration = parseDurationText(
            durationEl.textContent || durationEl.innerText,
        );

        const payload = {
            title,
            channel,
            description,
            videoId,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/default.jpg`,
            duration,
            genre,
        };

        chrome.runtime.sendMessage({ type: "analyse", payload }, (response) => {
            if (chrome.runtime.lastError) {
                console.error(
                    "Extension context invalidated:",
                    chrome.runtime.lastError.message,
                );
                return;
            }
            if (!response?.ok) {
                console.error("Analyse request failed:", response);
                return;
            }

            currentSessionId = response.data?.sessionId ?? null;

            chrome.runtime.sendMessage({
                type: "currentVideo",
                video: {
                    title,
                    channel,
                    thumbnailUrl: payload.thumbnailUrl,
                    isSong: response.data?.isSong ?? null,
                    videoId,
                },
            });
        });

        trackPlayback();
    } catch (error) {
        console.error("Error loading video data:", error);
    }
}

window.addEventListener("yt-navigate-finish", async () => {
    const newId = getVideoId();
    if (newId && newId !== currentVideoId) {
        currentVideoId = newId;
        await onNewVideoLoaded();
    }
});

window.addEventListener("beforeunload", () => {
    if (isPlaying) {
        totalListenMs += Date.now() - startTime;
        isPlaying = false;
    }

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
