let tabSessions = {};
const HEARTBEAT = "heartbeat";
// const apiURL = "http://localhost:3001/api";
const apiURL = "http://localhost:3000";

// ─── Message Events ──────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return;

    const tabId = sender.tab?.id;

    switch (message.type) {
        case "newVideo": {
            if (!tabId) return;
            handleNewVideo(tabId, message.payload); // async work moved out
            return;
        }
        case "getTabSessions": {
            sendResponse(tabSessions);
            return true;
        }
    }
});

// ─── Heartbeat ───────────────────────────────────────────────────────────────
chrome.alarms.create(HEARTBEAT, { periodInMinutes: 15 / 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== HEARTBEAT) return;

    for (const [tabIdStr, state] of Object.entries(tabSessions)) {
        if (!state.sessionId || !state.isSong) continue;

        accumulateTime(state);

        if (
            Math.abs(state.totalListenMs - state.lastSentMs) < 500 ||
            !state.isPlaying
        )
            continue; // No new listening time to report

        const listeningTime = (state.totalListenMs / 1000).toFixed(1);
        console.log(`💓 [tab ${tabIdStr}] ${state.title} — ${listeningTime}s`);

        await fetch(`${apiURL}/listen`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: state.sessionId, listeningTime }),
        }).catch((err) =>
            console.error(`[tab ${tabIdStr}] heartbeat failed:`, err),
        );
    }
});

// ─── Tab audible state changes → track listening time ─────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.audible === undefined) return;
    if (!(tabId in tabSessions)) return;

    const state = tabSessions[tabId];

    if (changeInfo.audible) {
        state.isPlaying = true;
        state.startTime = Date.now();
        console.log(`▶️ [tab ${tabId}] audible — clock started`);
    } else {
        accumulateTime(state);
        state.isPlaying = false;
        console.log(
            `⏸️ [tab ${tabId}] silent — accumulated ${state.totalListenMs}ms`,
        );
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId in tabSessions) {
        delete tabSessions[tabId];
        console.log(`Tab ${tabId} closed, session cleared`);
    }
});

// ─── Helper functions ─────────────────────────────────────────────────────────────
function accumulateTime(state) {
    if (state.isPlaying) {
        state.totalListenMs += Date.now() - state.startTime;
        state.startTime = Date.now();
    }
}

async function handleNewVideo(tabId, payload) {
    const existing = tabSessions[tabId];
    if (existing?.sessionId && existing?.isSong) {
        accumulateTime(existing);
        const listeningTime = (existing.totalListenMs / 1000).toFixed(1);
        if (existing.totalListenMs !== existing.lastSentMs) {
            await fetch(`${apiURL}/listen`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: existing.sessionId,
                    listeningTime,
                }),
            }).catch((err) =>
                console.error(`[tab ${tabId}] pre-reset flush failed:`, err),
            );
        }
    }

    tabSessions[tabId] = {
        sessionId: null,
        isSong: false,
        isPlaying: false,
        thumbnailUrl: null,
        channel: null,
        title: null,
        lastSentMs: 0,
        totalListenMs: 0,
        startTime: 0,
    };

    const res = await fetch(`${apiURL}/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const data = await res.json();
    const state = tabSessions[tabId];
    state.sessionId = data?.sessionId ?? null;
    state.isSong = data?.isSong ?? null;
    state.title = payload.title;
    state.thumbnailUrl = payload.thumbnailUrl;
    state.channel = payload.channel;

    const tab = await chrome.tabs.get(tabId);
    if (tab.audible) {
        state.isPlaying = true;
        state.startTime = Date.now();
        console.log(
            `▶️ [tab ${tabId}] already audible after analyse — clock started`,
        );
    }
}
