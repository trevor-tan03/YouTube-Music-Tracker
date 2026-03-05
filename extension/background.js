chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return;

    switch (message.type) {
        case "analyse": {
            const { payload } = message;
            fetch("http://localhost:3000/analyse", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })
                .then(async (res) => {
                    const data = await res.json().catch(() => ({}));
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
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ sessionId, listeningTime }),
            })
                .then(async (res) => {
                    const data = await res.json().catch(() => ({}));
                    sendResponse({ ok: res.ok, status: res.status, data });
                })
                .catch((err) => {
                    sendResponse({ ok: false, error: String(err) });
                });

            return true;
        }
        case "currentVideo": {
            currentVideo = message.video;
            chrome.storage.session.set({ ["currentVideo"]: currentVideo });
            return;
        }
    }
});
