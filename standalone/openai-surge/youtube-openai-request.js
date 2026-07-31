function readSetting(name) {
	const direct = $persistentStore.read(`@YouTubeOpenAI.Settings.${name}`);
	if (direct !== null && direct !== undefined) return direct;
	const stored = $persistentStore.read("YouTubeOpenAI");
	if (!stored) return null;
	try { return JSON.parse(stored)?.Settings?.[name] ?? null; } catch { return null; }
}

function readBoolean(name, fallback) {
	const value = readSetting(name);
	if (value === null || value === undefined || value === "") return fallback;
	return value === true || value === "true" || value === 1 || value === "1";
}

const enabled = readBoolean("Enabled", true);
const url = new URL($request.url);
if (enabled && url.pathname === "/api/timedtext") url.searchParams.set("fmt", "json3");
$done({ url: url.toString() });
