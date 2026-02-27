import { useState, useEffect } from "react";

const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap";
document.head.appendChild(fontLink);

const sans = "'DM Sans', system-ui, sans-serif";

const DEFAULT_TOPICS = [
  { id: "all",                 label: "All"           },
  { id: "graphic design",      label: "Graphic Design"},
  { id: "UX/UI",               label: "UX & UI"       },
  { id: "creative technology", label: "Creative Tech" },
  { id: "typography",          label: "Typography"    },
  { id: "branding",            label: "Branding"      },
  { id: "AI and design",       label: "AI & Design"   },
];

const VIEWS = [
  { id: "feed",       label: "Feed"       },
  { id: "favourites", label: "Favourites" },
  { id: "readlater",  label: "Read Later" },
];

function makeId(item) { return btoa(encodeURIComponent(item.headline)).slice(0, 24); }

function DraggableTopic({ topic, isActive, isEditMode, isDragging, onSelect, onDragStart, onDragEnter, onDragEnd }) {
  return (
    <button
      draggable={isEditMode}
      onDragStart={isEditMode ? onDragStart : undefined}
      onDragEnter={isEditMode ? onDragEnter : undefined}
      onDragEnd={isEditMode ? onDragEnd : undefined}
      onDragOver={isEditMode ? e => e.preventDefault() : undefined}
      onClick={!isEditMode ? onSelect : undefined}
      className={`topic-btn${isActive && !isEditMode ? " on" : ""}${isEditMode ? " edit" : ""}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      {isEditMode && <span style={{ fontSize: "0.65rem", marginRight: "0.25rem" }}>⠿</span>}
      {topic.label}
    </button>
  );
}

export default function App() {
  const [activeTopic,  setActiveTopic]  = useState("all");
  const [activeView,   setActiveView]   = useState("feed");
  const [news,         setNews]         = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [lastFetched,  setLastFetched]  = useState(null);
  const [error,        setError]        = useState(null);
  const [expandedId,   setExpandedId]   = useState(null);
  const [favourites,   setFavourites]   = useState({});
  const [readLater,    setReadLater]    = useState({});
  const [topics,       setTopics]       = useState(DEFAULT_TOPICS);
  const [isEditMode,   setIsEditMode]   = useState(false);
  const [dragIdx,      setDragIdx]      = useState(null);

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

  const savedItems = activeView === "favourites" ? Object.values(favourites) : Object.values(readLater);
  const favCount   = Object.keys(favourites).length;
  const rlCount    = Object.keys(readLater).length;

  const renderCard = (item, i) => {
    const id         = makeId(item);
    const isFav      = !!favourites[id];
    const isRL       = !!readLater[id];
    const isExpanded = expandedId === id;
    const num        = String(i + 1).padStart(2, "0");

    return (
      <div key={id} className="news-row" style={{ animationDelay: `${i * 0.06}s` }} onClick={() => setExpandedId(isExpanded ? null : id)}>
        <div style={{ paddingTop: "0.15rem" }}>
          <span style={{ fontFamily: sans, fontSize: "0.7rem", fontWeight: 400, letterSpacing: "0.05em" }}>{num}</span>
        </div>
        <div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.6rem" }}>
            <span style={{ fontFamily: sans, fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>{item.category}</span>
            <span style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#1A1A1A", flexShrink: 0 }} />
            <span style={{ fontFamily: sans, fontSize: "0.62rem" }}>{item.date}</span>
            {item.trending && (
              <span style={{ fontFamily: sans, fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", border: "1px solid #1A1A1A", padding: "0.1rem 0.5rem", borderRadius: "999px" }}>↑ Trending</span>
            )}
            <span style={{ marginLeft: "auto", fontSize: "0.7rem", display: "inline-block", transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>↓</span>
          </div>

          <h2 style={{ fontFamily: sans, fontSize: "clamp(1rem, 2vw, 1.2rem)", fontWeight: 400, lineHeight: 1.35, letterSpacing: "-0.01em", marginBottom: "0.75rem" }}>
            {item.headline}
          </h2>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
            {item.source_name && (
              <>
                <a href={item.source_url || "#"} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: sans, fontSize: "0.68rem", fontWeight: 500, color: "#1A1A1A", textDecoration: "none", letterSpacing: "0.03em", borderBottom: "1px solid #1A1A1A", paddingBottom: "1px" }}>
                  ↗ {item.source_name}
                </a>
                <span>|</span>
              </>
            )}
            <button className={`action-btn${isFav ? " on" : ""}`} onClick={e => toggleFav(e, item)}>{isFav ? "★ Favourited" : "☆ Favourite"}</button>
            <button className={`action-btn${isRL  ? " on" : ""}`} onClick={e => toggleRL(e, item)} >{isRL  ? "◷ Saved"      : "◷ Read Later"}</button>
          </div>

          {isExpanded && (
            <p style={{ marginTop: "1.25rem", fontFamily: sans, fontSize: "0.875rem", fontWeight: 300, lineHeight: 1.85, borderTop: "1px solid #1A1A1A", paddingTop: "1.25rem" }}>
              {item.summary}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: "#FDF8DC", minHeight: "100vh", fontFamily: sans, color: "#1A1A1A" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin   { to { transform: rotate(360deg); } }
        .topic-btn { font-family:'DM Sans',sans-serif; font-size:0.7rem; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; padding:0.3rem 0.85rem; border-radius:999px; border:1px solid #1A1A1A; background:transparent; color:#1A1A1A; cursor:pointer; transition:background 0.15s,color 0.15s; white-space:nowrap; user-select:none; }
        .topic-btn:hover,.topic-btn.on { background:#1A1A1A; color:#FDF8DC; }
        .topic-btn.edit { border-style:dashed; cursor:grab; }
        .action-btn { font-family:'DM Sans',sans-serif; font-size:0.68rem; font-weight:500; letter-spacing:0.05em; padding:0.25rem 0.75rem; border-radius:999px; border:1px solid #1A1A1A; background:transparent; color:#1A1A1A; cursor:pointer; transition:all 0.15s; }
        .action-btn:hover,.action-btn.on { background:#1A1A1A; color:#FDF8DC; }
        .view-btn { font-family:'DM Sans',sans-serif; font-size:0.7rem; font-weight:500; letter-spacing:0.08em; text-transform:uppercase; padding:0.3rem 0.85rem; border-radius:999px; border:1px solid #1A1A1A; background:transparent; color:#1A1A1A; cursor:pointer; transition:background 0.15s,color 0.15s; display:inline-flex; align-items:center; gap:0.35rem; }
        .view-btn:hover,.view-btn.on { background:#1A1A1A; color:#FDF8DC; }
        .news-row { display:grid; grid-template-columns:3rem 1fr; gap:0 1.5rem; border-top:1px solid #1A1A1A; padding:1.75rem 0; cursor:pointer; transition:background 0.15s,padding-left 0.2s; animation:fadeIn 0.4s ease both; }
        .news-row:hover { background:#F5EFBB; padding-left:0.5rem; }
        .news-row:last-of-type { border-bottom:1px solid #1A1A1A; }
      `}</style>

      {/* HEADER */}
      <header style={{ position: "sticky", top: 0, background: "#FDF8DC", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 2.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <p style={{ fontFamily: sans, fontSize: "0.65rem", fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Curated creativity, delivered daily
          </p>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
            {VIEWS.map(v => {
              const count = v.id === "favourites" ? favCount : v.id === "readlater" ? rlCount : 0;
              const isActive = activeView === v.id;
              return (
                <button key={v.id} className={`view-btn${isActive ? " on" : ""}`} onClick={() => setActiveView(v.id)}>
                  {v.label}
                  {count > 0 && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: isActive ? "#FDF8DC" : "#1A1A1A", color: isActive ? "#1A1A1A" : "#FDF8DC", borderRadius: "999px", padding: "0 0.35rem", lineHeight: 1.7 }}>{count}</span>}
                </button>
              );
            })}
            {activeView === "feed" && (
              <button className="view-btn" onClick={() => fetchNews(activeTopic)} disabled={loading} style={{ opacity: loading ? 0.5 : 1 }}>
                {loading ? "Fetching…" : "↻ Refresh"}
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: "0.5rem 2.5rem 1.5rem" }}>
          <h1 style={{ fontFamily: sans, fontSize: "clamp(1.5rem, 4vw, 2.5rem)", fontWeight: 300, letterSpacing: "-0.03em", lineHeight: 1.05, whiteSpace: "nowrap" }}>
            A Moment to Process
          </h1>
        </div>

        {activeView === "feed" && (
          <div style={{ padding: "0 2.5rem 1.5rem", display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
            {topics.map((t, i) => (
              <DraggableTopic key={t.id} topic={t} isActive={activeTopic === t.id} isEditMode={isEditMode} isDragging={dragIdx === i}
                onSelect={() => { setActiveTopic(t.id); fetchNews(t.id); }}
                onDragStart={() => handleDragStart(i)} onDragEnter={() => handleDragEnter(i)} onDragEnd={handleDragEnd} />
            ))}
            <button onClick={() => setIsEditMode(!isEditMode)}
              style={{ fontFamily: sans, fontSize: "0.65rem", fontWeight: 500, cursor: "pointer", border: "none", background: "none", color: "#1A1A1A", padding: "0.3rem 0.5rem", textDecoration: isEditMode ? "underline" : "none", textUnderlineOffset: "2px", letterSpacing: "0.05em" }}>
              {isEditMode ? "Done" : "Edit order"}
            </button>
          </div>
        )}
      </header>

      {/* BODY */}
      <main style={{ padding: "0 2.5rem 5rem", maxWidth: "860px", margin: "0 auto" }}>
        {activeView === "feed" && lastFetched && !loading && (
          <p style={{ fontFamily: sans, fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", margin: "1rem 0 0" }}>Updated {lastFetched}</p>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "5rem 0" }}>
            <div style={{ display: "inline-block", width: "24px", height: "24px", border: "1px solid #ccc", borderTop: "1px solid #1A1A1A", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
            <p style={{ marginTop: "1rem", fontFamily: sans, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Scanning the design world…</p>
          </div>
        )}

        {error && !loading && (
          <div style={{ marginTop: "2rem", padding: "1rem 1.25rem", border: "1px solid #1A1A1A", fontFamily: sans, fontSize: "0.8rem" }}>{error}</div>
        )}

        {activeView === "feed" && !loading && news.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            {news.map((item, i) => renderCard(item, i))}
            <p style={{ fontFamily: sans, fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center", marginTop: "2.5rem" }}>
              Click to expand · ↑ Trending · ↗ Source · ☆ Favourite · ◷ Read Later
            </p>
          </div>
        )}

        {(activeView === "favourites" || activeView === "readlater") && !loading && (
          savedItems.length === 0
            ? <div style={{ textAlign: "center", padding: "5rem 1rem", borderTop: "1px solid #1A1A1A", marginTop: "1rem" }}>
                <p style={{ fontFamily: sans, fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {activeView === "favourites" ? "No favourites yet — star stories from the feed." : "Nothing saved yet — mark stories to read later."}
                </p>
              </div>
            : <div style={{ marginTop: "1rem" }}>
                <p style={{ fontFamily: sans, fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", margin: "1rem 0 0" }}>
                  {savedItems.length} {activeView === "favourites" ? "favourited" : "saved"} {savedItems.length === 1 ? "story" : "stories"}
                </p>
                {savedItems.map((item, i) => renderCard(item, i))}
                <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
                  <button className="action-btn" onClick={() => activeView === "favourites" ? saveFav({}) : saveRL({})}>Clear all</button>
                </div>
              </div>
        )}
      </main>
    </div>
  );
}
