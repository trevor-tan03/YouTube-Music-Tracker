// tabId → { sessionId, isPlaying, totalListenMs, startTime }
let tabSessions = {};

const SEND_INTERVAL_MS = 30000;
const ALARM_NAME = "listenHeartbeat";

// ─── Persist / restore tabSessions across service worker restarts ─────────────

async function saveTabSessions() {
    await chrome.storage.session.set({ tabSessions });
}

async function restoreTabSessions() {
    const data = await chrome.storage.session.get("tabSessions");
    if (data.tabSessions) {
        tabSessions = data.tabSessions;
        // Reset isPlaying — we don't know the true audible state after restart.
        // onUpdated will re-set it if the tab is still audible.
        for (const state of Object.values(tabSessions)) {
            if (state.isPlaying) {
                // Accumulate whatever time had passed (rough, but better than losing it)
                state.totalListenMs +=
                    Date.now() - (state.startTime || Date.now());
                state.isPlaying = false;
                state.startTime = 0;
            }
        }
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreateTabState(tabId) {
    if (!tabSessions[tabId]) {
        tabSessions[tabId] = {
            sessionId: null,
            isPlaying: false,
            totalListenMs: 0,
            startTime: 0,
        };
    }
    return tabSessions[tabId];
}

function accumulateTime(state) {
    if (state.isPlaying) {
        state.totalListenMs += Date.now() - state.startTime;
        state.startTime = Date.now();
    }
}

async function sendListenUpdate(tabId, state, isFinal = false) {
    if (!state.sessionId || state.totalListenMs === 0) return;

    const listeningTime = (state.totalListenMs / 1000).toFixed(1);
    console.log(
        `📊 [tab ${tabId}] Sending${isFinal ? " final" : ""} listen update: ${listeningTime}s`,
    );

    try {
        const res = await fetch("http://localhost:3000/listen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: state.sessionId, listeningTime }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error(`[tab ${tabId}] Listen update failed:`, data);
        }
    } catch (err) {
        console.error(`[tab ${tabId}] Listen fetch error:`, err);
    }
}

// ─── Heartbeat via chrome.alarms (survives service worker restarts) ───────────

chrome.alarms.create(ALARM_NAME, { periodInMinutes: SEND_INTERVAL_MS / 60000 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;

    for (const [tabIdStr, state] of Object.entries(tabSessions)) {
        const tabId = Number(tabIdStr);
        if (!state.sessionId) continue;

        accumulateTime(state);
        await sendListenUpdate(tabId, state);
    }
    await saveTabSessions();
});

// ─── Audible tracking ─────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (!("audible" in changeInfo)) return;

    const state = tabSessions[tabId];
    if (!state) return;

    if (changeInfo.audible) {
        if (!state.isPlaying) {
            state.isPlaying = true;
            state.startTime = Date.now();
            console.log(`▶️  [tab ${tabId}] Audible — resuming`);
            await saveTabSessions();
        }
    } else {
        if (state.isPlaying) {
            accumulateTime(state);
            state.isPlaying = false;
            console.log(
                `⏸️  [tab ${tabId}] Silent — paused at ${(state.totalListenMs / 1000).toFixed(1)}s`,
            );
            await sendListenUpdate(tabId, state);
            await saveTabSessions();
        }
    }
});

// ─── Tab closed → flush final time ───────────────────────────────────────────

chrome.tabs.onRemoved.addListener(async (tabId) => {
    const state = tabSessions[tabId];
    if (!state) return;

    accumulateTime(state);
    await sendListenUpdate(tabId, state, true);
    delete tabSessions[tabId];
    chrome.storage.session.remove(`currentVideo_${tabId}`);
    await saveTabSessions();
    console.log(`🗑️  [tab ${tabId}] Removed — session cleaned up`);
});

// ─── Restore state on service worker startup ──────────────────────────────────

restoreTabSessions().then(() => {
    console.log("🔄 Service worker started — tab sessions restored");
});

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return;
    const tabId = sender.tab?.id;

    switch (message.type) {
        case "analyse": {
            const { payload } = message;

            if (tabId != null) {
                tabSessions[tabId] = {
                    sessionId: null,
                    isPlaying: false,
                    totalListenMs: 0,
                    startTime: 0,
                };
                saveTabSessions();
            }

            fetch("http://localhost:3000/analyse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
                .then(async (res) => {
                    const data = await res.json().catch(() => ({}));

                    if (tabId != null && data.sessionId) {
                        const state = getOrCreateTabState(tabId);
                        state.sessionId = data.sessionId;

                        chrome.tabs.get(tabId, async (tab) => {
                            if (chrome.runtime.lastError || !tab) return;
                            if (state.isPlaying) {
                                console.log(
                                    `▶️  [tab ${tabId}] analyse resolved — clock already running (started by onUpdated)`,
                                );
                            } else if (tab.audible) {
                                state.isPlaying = true;
                                state.startTime = Date.now();
                                console.log(
                                    `▶️  [tab ${tabId}] analyse resolved — tab is audible, starting clock`,
                                );
                            } else {
                                state.isPlaying = false;
                                console.log(
                                    `⏸️  [tab ${tabId}] analyse resolved — tab not audible, waiting`,
                                );
                            }
                            await saveTabSessions();
                        });
                    }

                    sendResponse({ ok: res.ok, status: res.status, data });
                })
                .catch((err) => {
                    sendResponse({ ok: false, error: String(err) });
                });

            return true;
        }

        case "listen": {
            const { sessionId, listeningTime } = message;
            fetch("http://localhost:3000/listen", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId, listeningTime }),
            })
                .then(async (res) => {
                    const data = await res.json().catch(() => ({}));
                    sendResponse({ ok: res.ok, status: res.status, data });
                })
                .catch((err) => {
                    sendResponse({ ok: false, error: String(err) });
                });

            if (tabId != null) {
                delete tabSessions[tabId];
                saveTabSessions();
            }

            return true;
        }

        case "getTabId": {
            sendResponse({ tabId: tabId ?? null });
            return;
        }

        case "currentVideo": {
            if (tabId != null) {
                chrome.storage.session.set({
                    [`currentVideo_${tabId}`]: message.video,
                });
            }
            return;
        }

        case "clearCurrentVideo": {
            if (tabId != null) {
                chrome.storage.session.remove(`currentVideo_${tabId}`);
            }
            return;
        }
    }
});
