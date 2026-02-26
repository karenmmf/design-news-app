import { useState, useEffect } from "react";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap";
document.head.appendChild(fontLink);

const C = {
  bg: "#FAF8F5", bgHover: "#F3F1ED",
  border: "#1A1A1A", borderFaint: "#D8D3CB",
  text: "#1A1A1A", textMid: "#6B6560", textFaint: "#A89E94",
  greige: "#C8BFB0", greigeText: "#5A5049",
};
const sans = "'DM Sans', system-ui, sans-serif";

const DEFAULT_TOPICS = [
  { id: "all", label: "All" },
  { id: "graphic design", label: "Graphic Design" },
  { id: "UX/UI", label: "UX & UI" },
  { id: "creative technology", label: "Creative Tech" },
  { id: "typography", label: "Typography" },
  { id: "branding", label: "Branding" },
  { id: "AI and design", label: "AI & Design" },
];

const VIEWS = [
  { id: "feed", label: "Feed" },
  { id: "favourites", label: "Favourites" },
  { id: "readlater", label: "Read Later" },
];

function makeId(item) { return btoa(encodeURIComponent(item.headline)).slice(0, 24); }

function pill(active) {
  return {
    display: "inline-flex", alignItems: "center", gap: "0.35rem",
    fontFamily: sans, fontSize: "0.74rem", fontWeight: 500,
    cursor: "pointer", border: `1px solid ${C.border}`, borderRadius: "999px",
    padding: "0.32rem 0.85rem",
    background: active ? C.text : "transparent",
    color: active ? "#FAF8F5" : C.text,
    transition: "background 0.15s, color 0.15s",
    lineHeight: 1.4, whiteSpace: "nowrap", userSelect: "none",
  };
}

function DraggableTopic({ topic, isActive, isEditMode, isDragging, onSelect, onDragStart, onDragEnter, onDragEnd }) {
  return (
    <div
      draggable={isEditMode}
      onDragStart={isEditMode ? onDragStart : undefined}
      onDragEnter={isEditMode ? onDragEnter : undefined}
      onDragEnd={isEditMode ? onDragEnd : undefined}
      onDragOver={isEditMode ? e => e.preventDefault() : undefined}
      onClick={!isEditMode ? onSelect : undefined}
      style={{
        ...pill(isActive && !isEditMode),
        cursor: isEditMode ? "grab" : "pointer",
        opacity: isDragging ? 0.4 : 1,
        border: isEditMode ? `1px dashed ${C.borderFaint}` : `1px solid ${C.border}`,
        background: isEditMode ? C.bgHover : isActive ? C.text : "transparent",
        color: isEditMode ? C.textMid : isActive ? "#FAF8F5" : C.text,
        paddingLeft: isEditMode ? "0.6rem" : "0.85rem",
      }}
    >
      {isEditMode && <span style={{ fontSize: "0.65rem", color: C.textFaint }}>⠿</span>}
      {topic.label}
    </div>
  );
}

export default function App() {
  const [activeTopic, setActiveTopic] = useState("all");
  const [activeView, setActiveView] = useState("feed");
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState(null);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [favourites, setFavourites] = useState({});
  const [readLater, setReadLater] = useState({});
  const [topics, setTopics] = useState(DEFAULT_TOPICS);
  const [isEditMode, setIsEditMode] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);

  useEffect(() => {
    try {
      const fav  = localStorage.getItem("dn-favourites");
      const rl   = localStorage.getItem("dn-readlater");
      const tops = localStorage.getItem("dn-topic-order");
      if (fav)  setFavourites(JSON.parse(fav));
      if (rl)   setReadLater(JSON.parse(rl));
      if (tops) {
        const saved  = JSON.parse(tops);
        const merged = saved.filter(s => DEFAULT_TOPICS.find(d => d.id === s.id));
        const extra  = DEFAULT_TOPICS.filter(d => !merged.find(m => m.id === d.id));
        setTopics([...merged, ...extra]);
      }
    } catch (_) {}
    fetchNews("all");
  }, []);

  const saveFav  = n => { setFavourites(n); localStorage.setItem("dn-favourites",  JSON.stringify(n)); };
  const saveRL   = n => { setReadLater(n);  localStorage.setItem("dn-readlater",   JSON.stringify(n)); };
  const saveTops = n => { setTopics(n);     localStorage.setItem("dn-topic-order", JSON.stringify(n)); };

  const toggleFav = (e, item) => { e.stopPropagation(); const id = makeId(item); const n = {...favourites}; if (n[id]) delete n[id]; else n[id] = item; saveFav(n); };
  const toggleRL  = (e, item) => { e.stopPropagation(); const id = makeId(item); const n = {...readLater};  if (n[id]) delete n[id]; else n[id] = item; saveRL(n); };

  const handleDragStart = i => setDragIdx(i);
  const handleDragEnter = i => {
    if (dragIdx === null || dragIdx === i) return;
    const r = [...topics]; const [m] = r.splice(dragIdx, 1); r.splice(i, 0, m);
    setDragIdx(i); setTopics(r);
  };
  const handleDragEnd = () => { setDragIdx(null); saveTops(topics); };

  const fetchNews = async (topic) => {
    setLoading(true); setError(null); setNews([]); setExpandedId(null);
    const q = topic === "all" ? "latest news in creativity and design" : `latest news in ${topic}`;
    try {
      const res  = await fetch("/api/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setNews(data);
      setLastFetched(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch { setError("Couldn't load news — please try again."); }
    finally  { setLoading(false); }
  };

  const sentimentDot = s => s === "exciting" ? "#3A7D44" : s === "critical" ? "#1A1A1A" : C.textFaint;
  const savedItems   = activeView === "favourites" ? Object.values(favourites) : Object.values(readLater);
  const favCount     = Object.keys(favourites).length;
  const rlCount      = Object.keys(readLater).length;

  const renderCard = (item, i) => {
    const id         = makeId(item);
    const isFav      = !!favourites[id];
    const isRL       = !!readLater[id];
    const isExpanded = expandedId === id;
    const isTrending = item.trending === true;

    return (
      <div key={id} onClick={() => setExpandedId(isExpanded ? null : id)}
        style={{ background: C.bg, borderBottom: `1px solid ${C.border}`, padding: "1.25rem 0", cursor: "pointer", transition: "background 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.background = C.bgHover}
        onMouseLeave={e => e.currentTarget.style.background = C.bg}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          <span style={{ fontFamily: sans, fontSize: "0.7rem", fontWeight: 500, color: C.textMid, textTransform: "uppercase", letterSpacing: "0.05em" }}>{item.category}</span>
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: sentimentDot(item.sentiment) }} />
          <span style={{ fontFamily: sans, fontSize: "0.7rem", color: C.textFaint }}>{item.date}</span>
          {isTrending && (
            <span style={{ fontFamily: sans, fontSize: "0.67rem", fontWeight: 500, color: C.greigeText, background: C.greige, padding: "0.15rem 0.6rem", borderRadius: "999px" }}>↑ Trending</span>
          )}
          <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: C.textFaint, display: "inline-block", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>↓</span>
        </div>
        <h2 style={{ fontFamily: sans, fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem", lineHeight: 1.4, color: C.text, letterSpacing: "-0.01em" }}>{item.headline}</h2>
        {item.source_name && (
          <div style={{ marginBottom: "0.75rem" }} onClick={e => e.stopPropagation()}>
            <a href={item.source_url || "#"} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: sans, fontSize: "0.71rem", color: C.textMid, textDecoration: "none", borderBottom: `1px solid ${C.borderFaint}`, paddingBottom: "1px" }}>
              ↗ {item.source_name}
            </a>
          </div>
        )}
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
          <button onClick={e => toggleFav(e, item)} style={{ ...pill(isFav),  fontSize: "0.71rem" }}>{isFav ? "★ Favourited" : "☆ Favourite"}</button>
          <button onClick={e => toggleRL(e, item)}  style={{ ...pill(isRL),   fontSize: "0.71rem" }}>{isRL  ? "◷ Saved"      : "◷ Read Later"}</button>
        </div>
        {isExpanded && (
          <p style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: `1px solid ${C.borderFaint}`, fontFamily: sans, fontSize: "0.875rem", lineHeight: 1.8, color: C.textMid }}>
            {item.summary}
          </p>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: sans, color: C.text }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>

      {/* Header */}
      <div style={{ background: C.bg, borderBottom: `1px solid ${C.border}`, padding: "1.75rem 2rem 1.25rem", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.1rem" }}>
            <div>
              <p style={{ fontFamily: sans, fontSize: "0.68rem", fontWeight: 500, color: C.textFaint, margin: "0 0 0.15rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Curated creativity, delivered daily</p>
              <h1 style={{ fontFamily: sans, fontSize: "clamp(1.3rem, 3vw, 1.8rem)", fontWeight: 600, margin: 0, letterSpacing: "-0.03em" }}>A Moment to Process</h1>
            </div>
            {activeView === "feed" && (
              <button onClick={() => fetchNews(activeTopic)} disabled={loading}
                style={{ ...pill(false), color: loading ? C.textFaint : C.text, cursor: loading ? "not-allowed" : "pointer", fontSize: "0.71rem" }}>
                {loading ? "Fetching…" : "↻ Refresh"}
              </button>
            )}
          </div>

          {/* View tabs */}
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.9rem" }}>
            {VIEWS.map(v => {
              const count    = v.id === "favourites" ? favCount : v.id === "readlater" ? rlCount : 0;
              const isActive = activeView === v.id;
              return (
                <button key={v.id} onClick={() => setActiveView(v.id)} style={pill(isActive)}>
                  {v.label}
                  {count > 0 && (
                    <span style={{ background: isActive ? "rgba(250,248,245,0.25)" : C.text, color: isActive ? C.bg : "#fff", borderRadius: "999px", padding: "0 0.38rem", fontSize: "0.6rem", fontWeight: 700, lineHeight: 1.7 }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Topic filters */}
          {activeView === "feed" && (
            <div>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                {topics.map((t, i) => (
                  <DraggableTopic key={t.id} topic={t} isActive={activeTopic === t.id} isEditMode={isEditMode} isDragging={dragIdx === i}
                    onSelect={() => { setActiveTopic(t.id); fetchNews(t.id); }}
                    onDragStart={() => handleDragStart(i)} onDragEnter={() => handleDragEnter(i)} onDragEnd={handleDragEnd} />
                ))}
                <button onClick={() => setIsEditMode(!isEditMode)}
                  style={{ fontFamily: sans, fontSize: "0.7rem", fontWeight: 500, cursor: "pointer", border: "none", background: "none", color: isEditMode ? C.text : C.textFaint, padding: "0.32rem 0.5rem", borderRadius: "999px", textDecoration: isEditMode ? "underline" : "none", textUnderlineOffset: "2px" }}>
                  {isEditMode ? "Done" : "Edit order"}
                </button>
              </div>
              {isEditMode && <p style={{ fontFamily: sans, fontSize: "0.68rem", color: C.textFaint, margin: "0.5rem 0 0" }}>Drag topics to reorder. Order saved automatically.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "0 2rem 4rem" }}>
        {activeView === "feed" && lastFetched && !loading && (
          <p style={{ fontFamily: sans, fontSize: "0.7rem", color: C.textFaint, margin: "1rem 0 0" }}>Last updated {lastFetched}</p>
        )}
        {loading && (
          <div style={{ textAlign: "center", padding: "5rem 0" }}>
            <div style={{ display: "inline-block", width: "28px", height: "28px", border: `1px solid ${C.borderFaint}`, borderTop: `1px solid ${C.text}`, borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
            <p style={{ marginTop: "1rem", fontFamily: sans, fontSize: "0.78rem", color: C.textFaint }}>Scanning the design world…</p>
          </div>
        )}
        {error && !loading && (
          <div style={{ marginTop: "1.5rem", padding: "0.9rem 1.1rem", border: `1px solid ${C.border}`, borderRadius: "8px", fontFamily: sans, fontSize: "0.8rem" }}>{error}</div>
        )}
        {activeView === "feed" && !loading && news.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: "1.25rem" }}>
            {news.map((item, i) => renderCard(item, i))}
            <p style={{ fontFamily: sans, fontSize: "0.67rem", color: C.textFaint, textAlign: "center", marginTop: "1.5rem" }}>
              Click a card to read · ↑ Trending · ↗ Source · ☆ Favourite · ◷ Read Later
            </p>
          </div>
        )}
        {(activeView === "favourites" || activeView === "readlater") && !loading && (
          savedItems.length === 0
            ? <div style={{ textAlign: "center", padding: "4rem 1rem", borderTop: `1px solid ${C.border}`, marginTop: "1.25rem" }}>
                <p style={{ fontFamily: sans, fontSize: "0.875rem", color: C.textFaint, margin: 0 }}>
                  {activeView === "favourites" ? "No favourites yet — star stories from the feed." : "Nothing saved yet — mark stories to read later."}
                </p>
              </div>
            : <div style={{ borderTop: `1px solid ${C.border}`, marginTop: "1.25rem" }}>
                <p style={{ fontFamily: sans, fontSize: "0.7rem", color: C.textFaint, margin: "0.75rem 0 0" }}>
                  {savedItems.length} {activeView === "favourites" ? "favourited" : "saved"} {savedItems.length === 1 ? "story" : "stories"}
                </p>
                {savedItems.map((item, i) => renderCard(item, i))}
                <div style={{ display: "flex", justifyContent: "center", marginTop: "1.5rem" }}>
                  <button onClick={() => activeView === "favourites" ? saveFav({}) : saveRL({})} style={{ ...pill(false), fontSize: "0.71rem" }}>Clear all</button>
                </div>
              </div>
        )}
      </div>
    </div>
  );
}
