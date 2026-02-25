// api/news.js
// This runs on Vercel's servers, keeping your API key safe.

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

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // ANTHROPIC_API_KEY is set in Vercel's environment variables (never in code)
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

    const data = await response.json();

    // Extract text content from the response
    const text = data.content
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    const clean = text.replace(/```json|```/g, "").trim();
    const articles = JSON.parse(clean);

    res.status(200).json(articles);
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
}
