// api/slack.js v2
// Sends a design news digest to Slack.
// Called by Vercel Cron (weekly digest) or slash command (/designnews).
export const config = { maxDuration: 60 };

const QUERY = "creativity design";

// ── Fetch news (reuses same logic as news.js) ──────────────────────────────
const SYSTEM_PROMPT = `You are a curator of the creative and design world. Find and summarize the latest news in creativity and design.
Return a JSON array of exactly 5 items:
[
  {
    "headline": "Short punchy headline",
    "summary": "2-3 sentence summary",
    "category": "Typography | Branding | UX | Tools | Industry | AI",
    "source_name": "Publication name",
    "source_url": "Direct URL to the specific article — NOT the homepage."
  }
]
Respond ONLY with the JSON array.`;

async function fetchNews() {
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
      messages: [{ role: "user", content: `Find 5 recent news items about: ${QUERY}` }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic returned ${response.status}`);

  const data = await response.json();
  const text = data.content
    .filter(b => b?.type === "text")
    .map(b => b.text)
    .join("");
  const clean = text.replace(/```json|```/g, "").trim();
  const articles = JSON.parse(clean);
  if (!Array.isArray(articles)) throw new Error("Response was not an array");
  return articles;
}

// ── Build Slack Block Kit message ──────────────────────────────────────────
function buildBlocks(articles, isLive = false) {
  const now = new Date().toLocaleDateString("no-NO", {
    timeZone: "Europe/Oslo",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const header = isLive
    ? "🟢  Ferskt akkurat nå"
    : "A MOMENT TO PROCESS";

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: header, emoji: true },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: isLive
            ? `Hentet live · ${now}`
            : `Ukentlig designdigest · ${now}`,
        },
      ],
    },
    { type: "divider" },
  ];

  articles.forEach((item, i) => {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${String(i + 1).padStart(2, "0")}  <${item.source_url}|${item.headline}>*\n${item.summary}\n_${item.source_name} · ${item.category}_`,
      },
    });
    if (i < articles.length - 1) blocks.push({ type: "divider" });
  });

  blocks.push(
    { type: "divider" },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<https://aiandcreativity-app.vercel.app|Les alle nyheter på nettsiden →>`,
        },
      ],
    }
  );

  return blocks;
}

// ── Post to Slack ──────────────────────────────────────────────────────────
async function postToSlack(blocks, responseUrl = null) {
  // If slash command — respond to response_url
  if (responseUrl) {
    const res = await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "in_channel",
        blocks,
      }),
    });
    if (!res.ok) throw new Error(`Slack response_url failed: ${res.status}`);
    return;
  }

  // Otherwise post to channel via Bot Token
  const channelId = process.env.SLACK_CHANNEL_ID;
  if (!channelId) throw new Error("SLACK_CHANNEL_ID not set");

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({ channel: channelId, blocks }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Slash command from Slack sends URL-encoded body
  const isSlashCommand = req.headers["content-type"]?.includes("application/x-www-form-urlencoded");
  const responseUrl = isSlashCommand ? req.body?.response_url : null;

  // Acknowledge Slack immediately (must respond within 3 seconds)
  if (isSlashCommand) {
    res.status(200).send("Henter designnyheter... 🔍");
  }

  try {
    const articles = await fetchNews();
    const blocks = buildBlocks(articles, isSlashCommand);
    await postToSlack(blocks, responseUrl);

    // For cron/manual calls, respond normally
    if (!isSlashCommand) {
      return res.status(200).json({ ok: true, sent: articles.length });
    }
  } catch (err) {
    console.error("Slack handler error:", err.message);
    if (!isSlashCommand) {
      return res.status(500).json({ error: err.message });
    }
  }
}
