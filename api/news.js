// api/news.js
// Fetches news from Anthropic and caches results in Vercel KV.
// Cache refreshes at 7am and 11am Oslo time — everyone else gets instant results.

export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = `You are a curator of the creative and design world. Find and summarize the latest news in creativity and design.

Return a JSON array of exactly 5 items:
[
  {
    "headline": "Short punchy headline",
    "summary": "2-3 sentence summary",
    "category": "Typography | Branding | UX | Tools | Industry | AI",
    "sentiment": "exciting | neutral | critical",
    "date": "approx date or 'Recent'",
    "trending": true or false,
    "source_name": "Publication name",
    "source_url": "Direct URL to the specific article — NOT the homepage. Must link to the actual article page."
  }
]
Respond ONLY with the JSON array.`;

// Returns a cache key that changes at 7am and 11am Oslo time
function getCacheKey(query) {
  const oslo = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Oslo" }));
  const date = oslo.toISOString().slice(0, 10);
  const hour = oslo.getHours();
  const slot = hour < 7 ? "prev" : hour < 11 ? "slot7" : "slot11";
  return `news::${query}::${date}::${slot}`;
}

async function fetchFromAnthropic(query) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: `Find 5 recent news items about: ${query}` }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Anthropic error:", response.status, err);
    throw new Error(`Anthropic returned ${response.status}`);
  }

  const data = await response.json();
  const text = data.content
    .filter(b => b && b.type === "text")
    .map(b => b.text)
    .join("");

  const clean = text.replace(/```json|```/g, "").trim();
  const articles = JSON.parse(clean);
  if (!Array.isArray(articles)) throw new Error("Response was not an array");
  return articles;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = (req.body?.query || "").trim();
  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  const cacheKey = getCacheKey(query);

  // Try to get cached version from Vercel KV
  try {
    const { kv } = await import("@vercel/kv");
    const cached = await kv.get(cacheKey);
    if (cached) {
      console.log("Cache hit:", cacheKey);
      return res.status(200).json(cached);
    }
  } catch (kvErr) {
    // KV not available — fall through to fresh fetch
    console.warn("KV unavailable, fetching fresh:", kvErr.message);
  }

  // No cache — fetch fresh from Anthropic
  try {
    console.log("Fetching fresh news for:", cacheKey);
    const articles = await fetchFromAnthropic(query);

    // Save to KV cache with 12 hour expiry
    try {
      const { kv } = await import("@vercel/kv");
      await kv.set(cacheKey, articles, { ex: 60 * 60 * 12 });
    } catch (_) {}

    return res.status(200).json(articles);
  } catch (err) {
    console.error("Fetch error:", err.message);
    return res.status(500).json({ error: "Couldn't load news — please try again in a moment." });
  }
}