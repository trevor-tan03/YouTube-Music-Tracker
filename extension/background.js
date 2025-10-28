chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message && message.type === "classifyVideo") {
		const { url, payload } = message;
		fetch(url, {
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
});
