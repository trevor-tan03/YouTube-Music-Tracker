export function validateLLMOutput(raw) {
	let data;

	// Try to parse JSON safely
	try {
		data = typeof raw === "string" ? JSON.parse(raw) : raw;
	} catch (e) {
		console.error("Invalid JSON:", e);
		return null;
	}

	// Define expected schema
	const schema = {
		isSong: "boolean",
		confidence: "number",
		reasoning: "string",
		extractedTitle: ["string", "object"], // allow null
		extractedArtist: ["string", "object"], // allow null
		videoType: ["string", "object"], // allow null
	};

	// Validate types
	for (const [key, expected] of Object.entries(schema)) {
		const val = data[key];
		const type = typeof val;

		// Null check (typeof null === 'object', so allow if included)
		if (val === null && expected.includes("object")) continue;

		// Expected can be a single string or array of acceptable types
		const expectedTypes = Array.isArray(expected) ? expected : [expected];

		if (!expectedTypes.includes(type)) {
			console.error(
				`Invalid type for "${key}": expected ${expected}, got ${type}`
			);
			return null;
		}
	}

	// Additional range checks
	if (
		typeof data.confidence === "number" &&
		(data.confidence < 0 || data.confidence > 1)
	) {
		console.error(`Invalid confidence: ${data.confidence}`);
		return null;
	}

	return data;
}
