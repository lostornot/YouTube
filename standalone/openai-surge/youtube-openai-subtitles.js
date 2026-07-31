/* Independent YouTube bilingual subtitles for Surge. Configuration is stored in BoxJs. */
const CONFIG = {
	enabled: $persistentStore.read("@YouTubeOpenAI.Settings.Enabled") !== "false",
	endpoint: $persistentStore.read("@YouTubeOpenAI.Settings.Endpoint") || "",
	apiKey: $persistentStore.read("@YouTubeOpenAI.Settings.APIKey") || "",
	model: $persistentStore.read("@YouTubeOpenAI.Settings.Model") || "",
	targetLanguage: $persistentStore.read("@YouTubeOpenAI.Settings.TargetLanguage") || "zh-Hans",
	sourceLanguage: $persistentStore.read("@YouTubeOpenAI.Settings.SourceLanguage") || "auto",
	showOnly: $persistentStore.read("@YouTubeOpenAI.Settings.ShowOnly") === "true",
	batchSize: 24,
	concurrency: 2,
};

function completionURL(endpoint) {
	const value = String(endpoint).trim().replace(/\/+$/, "");
	return /\/chat\/completions$/.test(value) ? value : `${value}/chat/completions`;
}

function postJSON(options) {
	return new Promise((resolve, reject) => {
		$httpClient.post(options, (error, response, data) => {
			if (error) return reject(new Error(String(error)));
			if (!response || response.status < 200 || response.status >= 300) return reject(new Error(`Translation API HTTP ${response?.status ?? "unknown"}: ${String(data ?? "").slice(0, 500)}`));
			resolve(data);
		});
	});
}

async function translateBatch(rows) {
	const data = await postJSON({
		url: completionURL(CONFIG.endpoint),
		headers: { Authorization: `Bearer ${CONFIG.apiKey}`, "Content-Type": "application/json; charset=utf-8", Accept: "application/json" },
		body: JSON.stringify({
			model: CONFIG.model,
			temperature: 0,
			messages: [
				{ role: "system", content: "You translate timed subtitles. Preserve the number and order of subtitle rows exactly. Preserve meaning, punctuation, names, numbers, and line breaks. Return only valid JSON in exactly this shape: {\\\"translations\\\":[\\\"...\\\"]}. Do not add Markdown or explanations." },
				{ role: "user", content: JSON.stringify({ source_language: CONFIG.sourceLanguage === "auto" ? "auto-detect" : CONFIG.sourceLanguage, target_language: CONFIG.targetLanguage, subtitles: rows }) },
			],
		}),
	});
	const body = JSON.parse(data);
	const content = body?.choices?.[0]?.message?.content;
	if (typeof content !== "string") throw new Error(body?.error?.message || "API response does not contain choices[0].message.content.");
	const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
	const translations = Array.isArray(parsed) ? parsed : parsed?.translations;
	if (!Array.isArray(translations) || translations.length !== rows.length || !translations.every(item => typeof item === "string")) throw new Error("API must return one JSON translation string per subtitle row.");
	return translations;
}

async function translateAll(rows) {
	const batches = [];
	for (let index = 0; index < rows.length; index += CONFIG.batchSize) batches.push(rows.slice(index, index + CONFIG.batchSize));
	const output = new Array(batches.length);
	let next = 0;
	const worker = async () => {
		while (next < batches.length) {
			const index = next++;
			output[index] = await translateBatch(batches[index]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(CONFIG.concurrency, batches.length) }, worker));
	return output.flat();
}

(async () => {
	if (!CONFIG.enabled) return $done({});
	if (!CONFIG.endpoint || !CONFIG.apiKey || !CONFIG.model) throw new Error("Set endpoint, API key, and model in BoxJs before enabling this script.");
	const subtitle = JSON.parse($response.body);
	if (!Array.isArray(subtitle.events)) throw new Error("Unexpected YouTube subtitle body; request stage must force fmt=json3.");
	const rows = [];
	const eventIndexes = [];
	subtitle.events.forEach((event, index) => {
		const text = event?.segs?.map(segment => segment?.utf8 ?? "").join("");
		if (text) { rows.push(text); eventIndexes.push(index); }
	});
	if (!rows.length) return $done({});
	const translations = await translateAll(rows);
	eventIndexes.forEach((eventIndex, rowIndex) => {
		const original = subtitle.events[eventIndex].segs.map(segment => segment?.utf8 ?? "").join("");
		subtitle.events[eventIndex].segs = [{ utf8: CONFIG.showOnly ? translations[rowIndex] : `${original}\n${translations[rowIndex]}` }];
	});
	$done({ body: JSON.stringify(subtitle) });
})().catch(error => { console.log(`[YouTube OpenAI subtitles] ${error.message || error}`); $done({}); });
