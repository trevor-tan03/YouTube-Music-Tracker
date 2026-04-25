// tabId → { sessionId, isPlaying, totalListenMs, startTime }
const tabSessions = {};

const SEND_INTERVAL_MS = 30000;

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

// ─── Global heartbeat ─────────────────────────────────────────────────────────

setInterval(() => {
    for (const [tabIdStr, state] of Object.entries(tabSessions)) {
        const tabId = Number(tabIdStr);
        if (!state.sessionId) continue;

        accumulateTime(state);
        sendListenUpdate(tabId, state);
    }
}, SEND_INTERVAL_MS);

// ─── Audible tracking ─────────────────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!("audible" in changeInfo)) return;

    // Always update isPlaying even if sessionId hasn't arrived yet from
    // /analyse — the heartbeat and sendListenUpdate guard on sessionId
    // themselves, so early audible events are safe to record.
    const state = tabSessions[tabId];
    if (!state) return; // tab has no pending/active session at all

    if (changeInfo.audible) {
        // Tab became audible → resume
        if (!state.isPlaying) {
            state.isPlaying = true;
            state.startTime = Date.now();
            console.log(`▶️  [tab ${tabId}] Audible — resuming`);
        }
    } else {
        // Tab went silent → pause (accumulate but keep session alive)
        if (state.isPlaying) {
            accumulateTime(state);
            state.isPlaying = false;
            console.log(
                `⏸️  [tab ${tabId}] Silent — paused at ${(state.totalListenMs / 1000).toFixed(1)}s`,
            );
            // Send an update immediately on pause so nothing is lost
            sendListenUpdate(tabId, state);
        }
    }
});

// ─── Tab closed → flush final time ───────────────────────────────────────────

chrome.tabs.onRemoved.addListener((tabId) => {
    const state = tabSessions[tabId];
    if (!state) return;

    accumulateTime(state);
    sendListenUpdate(tabId, state, true);
    delete tabSessions[tabId];
    chrome.storage.session.remove(`currentVideo_${tabId}`);
    console.log(`🗑️  [tab ${tabId}] Removed — session cleaned up`);
});

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return;
    const tabId = sender.tab?.id;

    switch (message.type) {
        case "analyse": {
            const { payload } = message;

            // Reset state for this tab — new video starting
            if (tabId != null) {
                tabSessions[tabId] = {
                    sessionId: null,
                    isPlaying: false,
                    totalListenMs: 0,
                    startTime: 0,
                };
            }

            fetch("http://localhost:3000/analyse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
                .then(async (res) => {
                    const data = await res.json().catch(() => ({}));

                    // Store sessionId, then query the tab's *actual* audible
                    // state to initialise isPlaying. This avoids the race where
                    // onUpdated fires before or after analyse resolves when
                    // multiple tabs are loading simultaneously.
                    if (tabId != null && data.sessionId) {
                        const state = getOrCreateTabState(tabId);
                        state.sessionId = data.sessionId;

                        chrome.tabs.get(tabId, (tab) => {
                            if (chrome.runtime.lastError || !tab) return;
                            // onUpdated may have already started the clock if
                            // the tab became audible before /analyse resolved.
                            // Only initialise if isPlaying hasn't been set yet.
                            if (state.isPlaying) {
                                console.log(
                                    `▶️  [tab ${tabId}] analyse resolved — clock already running (started by onUpdated)`,
                                );
                                return;
                            }
                            if (tab.audible) {
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
                        });
                    }

                    sendResponse({ ok: res.ok, status: res.status, data });
                })
                .catch((err) => {
                    sendResponse({ ok: false, error: String(err) });
                });

            return true; // keep channel open for async response
        }

        case "listen": {
            // Content script flushing on beforeunload — honour it directly
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

            // Clean up background state for this tab too
            if (tabId != null) {
                delete tabSessions[tabId];
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
