const enabled = $persistentStore.read("@YouTubeOpenAI.Settings.Enabled") !== "false";
const url = new URL($request.url);
if (enabled && url.pathname === "/api/timedtext") url.searchParams.set("fmt", "json3");
$done({ url: url.toString() });
