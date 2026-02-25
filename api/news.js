// api/news.js
// Runs on Vercel. Keeps API key server-side.

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

function safeJsonParse(str) {
  try {
    return { ok: true, value: JSON.parse(str) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = (req.body?.query || "").trim();
  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
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

    const rawText = await resp.text();

    // If Anthropic returns non-200, log and return readable error
    if (!resp.ok) {
      console.error("Anthropic error status:", resp.status);
      console.error("Anthropic error body:", rawText);
      return res.status(500).json({
        error: "Anthropic API error",
        status: resp.status,
      });
    }

    const parsed = safeJsonParse(rawText);
    if (!parsed.ok) {
      console.error("Failed to parse Anthropic JSON:", parsed.error);
      console.error("Raw body:", rawText);
      return res.status(500).json({ error: "Bad response from Anthropic" });
    }

    const data = parsed.value;

    // Guard: content may be missing in some error shapes
    if (!data?.content || !Array.isArray(data.content)) {
      console.error("Unexpected Anthropic response shape:", data);
      return res.status(500).json({ error: "Unexpected response from Anthropic" });
    }

    // Extract only text blocks
    const text = data.content
      .filter((b) => b && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("");

    const clean = text.replace(/```json|```/g, "").trim();

    const articlesParsed = safeJsonParse(clean);
    if (!articlesParsed.ok) {
      console.error("Model did not return valid JSON array.");
      console.error("Cleaned text was:", clean);
      return res.status(500).json({ error: "Model output was not valid JSON" });
    }

    const articles = articlesParsed.value;

    // Optional sanity check
    if (!Array.isArray(articles)) {
      console.error("Model output JSON is not an array:", articles);
      return res.status(500).json({ error: "Model output was not an array" });
    }

    return res.status(200).json(articles);
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: "Failed to fetch news" });
  }
}