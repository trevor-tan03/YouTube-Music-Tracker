function renderVideos(videos) {
    const container = document.getElementById("now-playing");

    if (!videos.length) {
        container.innerHTML = `
            <div class="idle">
                <span class="idle-dot"></span>
                Nothing playing
            </div>`;
        return;
    }

    container.innerHTML = videos
        .map((video, i) => {
            const isSong = video.isSong;
            const label =
                isSong === true
                    ? "Song"
                    : isSong === false
                      ? "Not a song"
                      : "Unknown";
            const labelClass =
                isSong === true
                    ? "badge song"
                    : isSong === false
                      ? "badge not-song"
                      : "badge unknown";

            const divider =
                i < videos.length - 1 ? '<div class="divider"></div>' : "";

            return `
            <div class="video-row">
                <img class="thumb" src="${video.thumbnailUrl}" alt="" width="80" height="45" />
                <div class="info">
                    <div class="title">${video.title}</div>
                    <div class="channel">${video.channel}</div>
                    <span class="${labelClass}">${label}</span>
                </div>
            </div>${divider}`;
        })
        .join("");
}

document.addEventListener("DOMContentLoaded", async () => {
    chrome.runtime.sendMessage({ type: "getTabSessions" }, (tabSessions) => {
        const videos = Object.values(tabSessions ?? {})
            .filter((state) => state.isSong !== null)
            .map((state) => ({
                title: state.title,
                channel: state.channel,
                thumbnailUrl: state.thumbnailUrl,
                isSong: state.isSong,
            }));
        renderVideos(videos);
    });
});

document.getElementById("open-dashboard").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});
