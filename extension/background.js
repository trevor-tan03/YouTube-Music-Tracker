let tabSessions = {};

// ─── Message Events ──────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (!message) return;

    const tabId = sender.tab?.id;
    if (!tabId) return;

    switch (message.type) {
        case "newVideo": {
            tabSessions[tabId] = {
                sessionId: null,
                isSong: false,
                isPlaying: false,
                totalListenMs: 0,
                startTime: 0,
            };

            const res = await fetch("http://localhost:3000/analyse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(message.payload),
            });

            const data = await res.json().catch(() => ({}));
            const state = tabSessions[tabId];
            state.sessionId = data?.sessionId ?? null;
            state.isSong = data?.isSong ?? null;

            // /analyse took a few seconds — check real audible state now
            const tab = await chrome.tabs.get(tabId);
            if (tab.audible) {
                state.isPlaying = true;
                state.startTime = Date.now();
                console.log(
                    `▶️ [tab ${tabId}] already audible after analyse — clock started`,
                );
            }
        }
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
