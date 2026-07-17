// This script is used to

function isAdPlaying() {
    return Boolean(document.querySelector("div.ad-showing"));
}

function getVideoId() {
    return new URL(window.location.href).searchParams.get("v");
}

function parseIsoDuration(iso) {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const [, h = 0, m = 0, s = 0] = match;
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

async function getVideoMetadata() {
    await new Promise((r) => setTimeout(r, 2000));

    const microformatScript = document.querySelector(
        "#microformat > player-microformat-renderer > script",
    );
    if (!microformatScript) {
        console.error("Microformat script not found");
        return;
    }

    const avatar = document.querySelector("#avatar > img")[3] || null;

    const {
        author: channel,
        name: title,
        description,
        genre,
        thumbnailUrl,
        duration,
        uploadDate,
    } = JSON.parse(microformatScript.innerText);

    return {
        channel,
        title,
        description,
        genre,
        thumbnailUrl,
        duration: parseIsoDuration(duration),
        uploadDate,
        avatar,
    };
}

async function onNewVideoLoaded() {
    const videoId = getVideoId();
    if (!videoId) return;

    const metadata = await getVideoMetadata();
    if (!metadata) return;

    return { videoId, ...metadata, isAdPlaying: isAdPlaying() };
}

window.addEventListener("yt-navigate-finish", async () => {
    const videoData = await onNewVideoLoaded();

    if (videoData) {
        chrome.runtime.sendMessage({
            type: "newVideo",
            payload: videoData,
        });
    }
});
