import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import jsPDF from "jspdf";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  CONSTANTS & HELPERS                         */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const LS_KEY = "researchai_chats";

const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const relativeTime = (ts) => {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString("en", { month: "short", day: "numeric" });
};

const dateGroup = (ts) => {
  const now = new Date();
  const d = new Date(ts);
  const diff = Math.floor((now.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Previous 7 Days";
  if (diff < 30) return "This Month";
  return "Older";
};

/* localStorage persistence */
const loadChats = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
};
const saveChats = (chats) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(chats)); } catch {/* full */}
};

const newChat = () => ({
  id: uid(), title: "New Research", messages: [],
  fileInfo: null, summary: "", createdAt: Date.now(), updatedAt: Date.now(),
});

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  SVG ICONS                                   */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const I = {
  Menu: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="16" y2="12"/><line x1="3" y1="17" x2="12" y2="17"/></svg>,
  Plus: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Send: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  Upload: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  File: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Star: (p) => <svg {...p} viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/></svg>,
  Down: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  Trash: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>,
  Search: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Clip: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
  X: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Zap: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Brain: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/><line x1="9" y1="21" x2="15" y2="21"/><line x1="10" y1="24" x2="14" y2="24"/></svg>,
  Doc: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  Chart: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Shield: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Sidebar: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>,
};
const icon = (Comp, s = 16) => <Comp width={s} height={s} style={{ flexShrink: 0 }} />;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  SUB-COMPONENTS                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const Orbs = () => (
  <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
    <div style={{ position:"absolute", width:550, height:550, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,91,245,0.1) 0%, transparent 70%)", top:"-8%", right:"-6%", animation:"float1 22s ease-in-out infinite" }}/>
    <div style={{ position:"absolute", width:650, height:650, borderRadius:"50%", background:"radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)", bottom:"-12%", left:"-8%", animation:"float2 28s ease-in-out infinite" }}/>
    <div style={{ position:"absolute", width:350, height:350, borderRadius:"50%", background:"radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)", top:"45%", left:"55%", animation:"float3 32s ease-in-out infinite" }}/>
  </div>
);

const Typing = () => (
  <div style={{ display:"flex", alignItems:"center", gap:5, padding:"14px 0" }}>
    {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent)", animation:`typingDot 1.4s ${i*0.16}s infinite ease-in-out` }}/>)}
    <span style={{ marginLeft:8, fontSize:12, color:"var(--text-3)", fontStyle:"italic" }}>thinking...</span>
  </div>
);

const Msg = ({ m }) => {
  const u = m.role === "user";
  return (
    <div className="anim-slideUp" style={{ display:"flex", gap:12, padding:"10px 0", flexDirection: u ? "row-reverse" : "row", alignItems:"flex-start" }}>
      <div style={{
        width:32, height:32, borderRadius:10, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff",
        background: u ? "var(--bg-hover)" : "var(--grad)",
        boxShadow: u ? "none" : "0 0 16px var(--accent-glow)",
      }}>
        {u ? "Y" : icon(I.Star, 14)}
      </div>
      <div style={{
        maxWidth:"78%", padding:"12px 16px", borderRadius: u ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: u ? "rgba(124,91,245,0.1)" : "var(--bg-surface)", border: `1px solid ${u ? "rgba(124,91,245,0.18)" : "var(--border)"}`,
        fontSize:14, lineHeight:1.75, color:"var(--text)", whiteSpace:"pre-wrap", wordBreak:"break-word",
      }}>
        {m.content}
        {m.sources?.length > 0 && (
          <div style={{ marginTop:10, paddingTop:8, borderTop:"1px solid var(--border)", display:"flex", flexWrap:"wrap", gap:5 }}>
            {m.sources.map((s,i) => (
              <span key={i} style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)", color:"var(--accent-2)", fontFamily:"'JetBrains Mono',monospace" }}>
                Chunk {s.chunk_index ?? i+1} · {(s.score*100).toFixed(0)}%
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FEATS = [
  { icon: I.Upload, title: "Upload PDFs", desc: "Drag & drop documents for instant vectorized analysis", color: "#7c5bf5" },
  { icon: I.Brain, title: "Deep Analysis", desc: "Ask complex questions and get AI-powered answers with citations", color: "#3b82f6" },
  { icon: I.Chart, title: "Smart Summaries", desc: "Generate executive summaries and extract key insights", color: "#f59e0b" },
  { icon: I.Shield, title: "Export Reports", desc: "Download your analysis as professional PDF reports", color: "#22c55e" },
];

const Welcome = ({ onUpload, fileRef }) => (
  <div className="anim-fadeIn" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, padding:"40px 20px", textAlign:"center" }}>
    <div style={{ width:56, height:56, borderRadius:16, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20, boxShadow:"0 0 30px var(--accent-glow)" }}>
      {icon(I.Star, 24)}
    </div>
    <h2 style={{ fontSize:28, fontWeight:800, background:"linear-gradient(135deg, var(--text), var(--text-2))", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:8, letterSpacing:"-0.03em" }}>
      Welcome to ResearchAI
    </h2>
    <p style={{ fontSize:15, color:"var(--text-2)", maxWidth:460, marginBottom:36, lineHeight:1.7 }}>
      Your intelligent document analysis companion. Upload a PDF to begin exploring, questioning, and extracting insights.
    </p>

    {/* Feature Grid */}
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:12, maxWidth:680, width:"100%", marginBottom:32 }}>
      {FEATS.map((f, i) => (
        <div key={i} className="anim-scaleIn" style={{
          padding:"20px 16px", borderRadius:16, background:"var(--bg-surface)", border:"1px solid var(--border)",
          textAlign:"left", cursor:"default", transition:"all 0.25s", animationDelay:`${i*0.08}s`,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = `${f.color}40`; e.currentTarget.style.background = `${f.color}08`; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-surface)"; }}
        >
          <div style={{ width:36, height:36, borderRadius:10, background:`${f.color}15`, display:"flex", alignItems:"center", justifyContent:"center", color:f.color, marginBottom:12 }}>
            {icon(f.icon, 18)}
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:"var(--text)", marginBottom:4 }}>{f.title}</div>
          <div style={{ fontSize:12, color:"var(--text-2)", lineHeight:1.6 }}>{f.desc}</div>
        </div>
      ))}
    </div>

    {/* Upload CTA */}
    <button onClick={() => fileRef.current?.click()} style={{
      padding:"14px 32px", borderRadius:14, border:"none", background:"var(--grad)", color:"#fff",
      fontSize:15, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:10,
      boxShadow:"0 4px 20px var(--accent-glow)", transition:"all 0.3s",
    }}
    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
    onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
    >
      {icon(I.Upload, 18)} Upload Your First Document
    </button>
  </div>
);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  MAIN COMPONENT                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function HomeGPT() {
  /* ── State ── */
  const [chats, setChats] = useState(() => { const c = loadChats(); return c.length ? c : [newChat()]; });
  const [activeId, setActiveId] = useState(() => { const c = loadChats(); return c.length ? c[0].id : chats[0].id; });
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [hoveredChat, setHoveredChat] = useState(null);

  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const abortRefs = useRef({ upload: null, ask: null, summary: null });

  const chat = useMemo(() => chats.find(c => c.id === activeId) || chats[0], [chats, activeId]);

  /* ── Effects ── */
  useEffect(() => { saveChats(chats); }, [chats]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat?.messages, isAsking]);
  useEffect(() => {
    const h = () => { setIsMobile(window.innerWidth <= 768); if (window.innerWidth > 768) setSidebarOpen(true); };
    window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
  }, []);
  useEffect(() => {
    const ta = inputRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; }
  }, [question]);
  useEffect(() => () => { Object.values(abortRefs.current).forEach(c => c?.abort()); }, []);

  /* ── Chat CRUD ── */
  const updateChat = useCallback((id, fn) => {
    setChats(prev => prev.map(c => c.id === id ? { ...c, ...fn(c), updatedAt: Date.now() } : c));
  }, []);

  const addMsg = useCallback((role, content, extras = {}) => {
    const msg = { id: uid(), role, content, ...extras };
    updateChat(activeId, c => ({ messages: [...c.messages, msg] }));
    return msg;
  }, [activeId, updateChat]);

  const createNewChat = () => {
    const c = newChat();
    setChats(prev => [c, ...prev]);
    setActiveId(c.id);
    setQuestion("");
    setUploadError(null);
    if (isMobile) setSidebarOpen(false);
  };

  const switchChat = (id) => {
    setActiveId(id);
    setQuestion("");
    setUploadError(null);
    if (isMobile) setSidebarOpen(false);
  };

  const deleteChat = (id, e) => {
    e.stopPropagation();
    setChats(prev => {
      const next = prev.filter(c => c.id !== id);
      if (!next.length) next.push(newChat());
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  };

  /* ── Auto-title from first user message ── */
  const autoTitle = (q) => {
    if (chat.title === "New Research") {
      updateChat(activeId, () => ({ title: q.length > 40 ? q.slice(0, 40) + "…" : q }));
    }
  };

  /* ── Upload ── */
  const handleUpload = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) { setUploadError("Only PDF files supported."); return; }
    if (file.size > 100 * 1024 * 1024) { setUploadError("File too large (max 100MB)."); return; }

    setUploadError(null); setIsUploading(true); setUploadProgress(0);
    const prog = setInterval(() => setUploadProgress(p => Math.min(p + Math.random() * 12, 90)), 300);

    const fd = new FormData(); fd.append("file", file);
    const ctrl = new AbortController(); abortRefs.current.upload = ctrl;

    try {
      const r = await fetch(`${API}/upload`, { method: "POST", body: fd, signal: ctrl.signal });
      if (!r.ok) throw new Error("Upload failed. Check backend.");
      const d = await r.json();
      clearInterval(prog); setUploadProgress(100);
      updateChat(activeId, () => ({ fileInfo: { filename: d.filename, chunks: d.total_chunks } }));
      addMsg("assistant", `✅ **${d.filename}** processed — ${d.total_chunks} semantic chunks indexed.\n\nAsk me anything about this document or choose a suggestion below.`);
      autoTitle(d.filename.replace(".pdf", ""));
    } catch (e) {
      clearInterval(prog);
      if (e.name !== "AbortError") setUploadError(e.message);
    } finally { setIsUploading(false); setTimeout(() => setUploadProgress(0), 800); }
  };

  /* ── Ask ── */
  const handleAsk = async () => {
    const q = question.trim(); if (!q || isAsking) return;
    setQuestion(""); addMsg("user", q); autoTitle(q); setIsAsking(true);

    const ctrl = new AbortController(); abortRefs.current.ask = ctrl;
    try {
      const hist = chat.messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const r = await fetch(`${API}/ask`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history: hist }), signal: ctrl.signal,
      });
      if (!r.ok) throw new Error("Request failed.");
      const d = await r.json();
      addMsg("assistant", d.answer, { sources: d.sources });
    } catch (e) {
      if (e.name !== "AbortError") addMsg("assistant", "⚠️ Could not process your request. Please try again.");
    } finally { setIsAsking(false); }
  };

  /* ── Summary ── */
  const handleSummary = async () => {
    if (isGeneratingSummary) return;
    setIsGeneratingSummary(true);
    addMsg("user", "Generate an executive summary.");
    const ctrl = new AbortController(); abortRefs.current.summary = ctrl;
    try {
      const r = await fetch(`${API}/summary`, { method: "POST", signal: ctrl.signal });
      if (!r.ok) throw new Error("Failed.");
      const d = await r.json();
      updateChat(activeId, () => ({ summary: d.summary }));
      addMsg("assistant", d.summary);
    } catch (e) {
      if (e.name !== "AbortError") addMsg("assistant", "⚠️ Could not generate summary.");
    } finally { setIsGeneratingSummary(false); }
  };

  /* ── Export ── */
  const exportPDF = () => {
    const text = chat.summary || chat.messages.filter(m => m.role === "assistant").map(m => m.content).join("\n\n---\n\n");
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(124, 91, 245);
    doc.text("ResearchAI — Analysis Report", 20, 22);
    doc.setDrawColor(124, 91, 245); doc.setLineWidth(0.5); doc.line(20, 27, 190, 27);
    doc.setFont("Helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
    doc.text(doc.splitTextToSize(text, 170), 20, 37);
    doc.save(`ResearchAI_${Date.now().toString().slice(-6)}.pdf`);
  };

  /* ── Grouped chats ── */
  const grouped = useMemo(() => {
    const filtered = search ? chats.filter(c => c.title.toLowerCase().includes(search.toLowerCase())) : chats;
    const groups = {};
    filtered.sort((a, b) => b.updatedAt - a.updatedAt).forEach(c => {
      const g = dateGroup(c.updatedAt);
      (groups[g] ||= []).push(c);
    });
    return groups;
  }, [chats, search]);

  const SUGGESTIONS = [
    { emoji: "📊", text: "Generate executive summary" },
    { emoji: "🔬", text: "Extract key metrics" },
    { emoji: "🧠", text: "Identify core arguments" },
    { emoji: "📋", text: "List all findings" },
  ];

  /* ━━━ RENDER ━━━ */
  const sidebarW = 280;

  // --- Shared Sidebar Content ---
  const SidebarContent = (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg-sidebar)", position:"relative" }}>
      {/* Top glow */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:100, background:"linear-gradient(180deg, rgba(124,91,245,0.06) 0%, transparent 100%)", pointerEvents:"none" }}/>

      {/* Header */}
      <div style={{ padding:"18px 16px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 18px var(--accent-glow)" }}>
            {icon(I.Star, 16)}
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"var(--text)", letterSpacing:"-0.02em" }}>ResearchAI</div>
            <div style={{ fontSize:9, color:"var(--text-3)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Intelligence Engine</div>
          </div>
        </div>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} style={{ width:32, height:32, borderRadius:8, background:"var(--bg-hover)", border:"none", color:"var(--text-2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {icon(I.X, 16)}
          </button>
        )}
      </div>

      {/* New Chat */}
      <div style={{ padding:"12px 12px 4px" }}>
        <button onClick={createNewChat} style={{
          width:"100%", padding:"10px 14px", borderRadius:12, border:"1px dashed rgba(124,91,245,0.3)",
          background:"var(--grad-subtle)", color:"var(--text)", fontSize:13, fontWeight:600,
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 12px var(--accent-glow)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(124,91,245,0.3)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          {icon(I.Plus, 15)} New Research
        </button>
      </div>

      {/* Search */}
      <div style={{ padding:"8px 12px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)" }}>
          <div style={{ color:"var(--text-3)", flexShrink:0 }}>{icon(I.Search, 14)}</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats..."
            style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"var(--text)", fontSize:13, fontFamily:"inherit" }}
          />
        </div>
      </div>

      {/* Chat List */}
      <div style={{ flex:1, overflowY:"auto", padding:"4px 8px 8px" }}>
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <div style={{ fontSize:10, fontWeight:700, color:"var(--text-3)", letterSpacing:"0.1em", textTransform:"uppercase", padding:"12px 8px 6px" }}>{group}</div>
            {items.map(c => (
              <button key={c.id} onClick={() => switchChat(c.id)}
                onMouseEnter={() => setHoveredChat(c.id)} onMouseLeave={() => setHoveredChat(null)}
                style={{
                  width:"100%", padding:"10px 10px", borderRadius:10, border:"none", textAlign:"left",
                  background: c.id === activeId ? "var(--bg-active)" : "transparent",
                  borderLeft: c.id === activeId ? "2px solid var(--accent)" : "2px solid transparent",
                  cursor:"pointer", display:"flex", alignItems:"center", gap:10, transition:"all 0.15s", marginBottom:2,
                  ...(hoveredChat === c.id && c.id !== activeId ? { background: "var(--bg-hover)" } : {}),
                }}
              >
                <div style={{ width:28, height:28, borderRadius:8, background: c.id === activeId ? "var(--accent)15" : "var(--bg-surface)", display:"flex", alignItems:"center", justifyContent:"center", color: c.id === activeId ? "var(--accent)" : "var(--text-3)", flexShrink:0 }}>
                  {icon(c.fileInfo ? I.File : I.Doc, 13)}
                </div>
                <div style={{ flex:1, overflow:"hidden" }}>
                  <div style={{ fontSize:13, fontWeight: c.id === activeId ? 600 : 500, color: c.id === activeId ? "var(--text)" : "var(--text-2)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {c.messages.length ? c.messages[c.messages.length-1].content.slice(0, 40) : "No messages yet"}
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                  <span style={{ fontSize:10, color:"var(--text-3)" }}>{relativeTime(c.updatedAt)}</span>
                  {hoveredChat === c.id && (
                    <button onClick={(e) => deleteChat(c.id, e)} style={{ width:22, height:22, borderRadius:6, background:"rgba(239,68,68,0.1)", border:"none", color:"var(--red)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {icon(I.Trash, 11)}
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding:"12px 16px", borderTop:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--green)", animation:"pulseGlow 2s ease-in-out infinite" }}/>
          <span style={{ fontSize:11, color:"var(--text-3)", fontWeight:500 }}>Online</span>
        </div>
        <span style={{ fontSize:9, color:"var(--text-3)", fontFamily:"'JetBrains Mono',monospace" }}>v3.0</span>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", height:"100vh", height:"100dvh", width:"100vw", background:"var(--bg-root)", position:"relative", overflow:"hidden" }}>
      <Orbs />

      {/* ═══ SIDEBAR — Desktop ═══ */}
      <aside className="sidebar-desktop" style={{
        width: sidebarOpen ? sidebarW : 0, minWidth: sidebarOpen ? sidebarW : 0,
        height:"100%", borderRight: sidebarOpen ? "1px solid var(--border)" : "none",
        transition:"all 0.3s cubic-bezier(0.4,0,0.2,1)", overflow:"hidden", position:"relative", zIndex:20,
      }}>
        {SidebarContent}
      </aside>

      {/* ═══ SIDEBAR — Mobile Overlay ═══ */}
      {isMobile && sidebarOpen && (
        <>
          <div className="sidebar-mobile-overlay" onClick={() => setSidebarOpen(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)", zIndex:90, animation:"fadeIn 0.2s ease" }}
          />
          <aside className="anim-fadeSlideRight" style={{
            position:"fixed", top:0, left:0, bottom:0, width: Math.min(sidebarW, window.innerWidth - 40),
            zIndex:100, boxShadow:"4px 0 24px rgba(0,0,0,0.4)",
          }}>
            {SidebarContent}
          </aside>
        </>
      )}

      {/* ═══ MAIN ═══ */}
      <main style={{ flex:1, display:"flex", flexDirection:"column", height:"100%", position:"relative", zIndex:5, overflow:"hidden" }}>

        {/* ── Top Bar ── */}
        <header style={{
          display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px",
          background:"rgba(11,11,16,0.7)", backdropFilter:"blur(12px)", borderBottom:"1px solid var(--border)", minHeight:54,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {/* Mobile hamburger */}
            <button className="mobile-header" onClick={() => setSidebarOpen(true)} style={{
              width:36, height:36, borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)",
              color:"var(--text-2)", cursor:"pointer", alignItems:"center", justifyContent:"center",
            }}>
              {icon(I.Menu, 18)}
            </button>
            {/* Desktop sidebar toggle */}
            {!isMobile && (
              <button onClick={() => setSidebarOpen(p => !p)} style={{
                width:34, height:34, borderRadius:9, background:"var(--bg-surface)", border:"1px solid var(--border)",
                color:"var(--text-2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "var(--bg-surface)"}
              >
                {icon(I.Sidebar, 15)}
              </button>
            )}
            <div>
              <h1 style={{ fontSize:15, fontWeight:700, color:"var(--text)", letterSpacing:"-0.01em", lineHeight:1.2 }}>
                {chat.title}
              </h1>
              <div style={{ fontSize:11, color:"var(--text-3)" }}>
                {chat.fileInfo ? `📄 ${chat.fileInfo.filename} · ${chat.fileInfo.chunks} chunks` : "Ready for upload"}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display:"flex", gap:6 }}>
            {chat.fileInfo && (
              <>
                <button onClick={handleSummary} disabled={isGeneratingSummary} style={{
                  padding:"7px 14px", borderRadius:9, background:"var(--grad-subtle)", border:"1px solid var(--border-active)",
                  color:"#c4b5fd", fontSize:12, fontWeight:600, cursor: isGeneratingSummary ? "wait" : "pointer",
                  display:"flex", alignItems:"center", gap:5, transition:"all 0.2s", opacity: isGeneratingSummary ? 0.5 : 1,
                }}>
                  {icon(I.Zap, 13)} <span className="sidebar-desktop" style={{ display:"inline" }}>Summary</span>
                </button>
                <button onClick={exportPDF} style={{
                  padding:"7px 14px", borderRadius:9, background:"var(--bg-surface)", border:"1px solid var(--border)",
                  color:"var(--text-2)", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5, transition:"all 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={e => e.currentTarget.style.background = "var(--bg-surface)"}
                >
                  {icon(I.Down, 13)} <span className="sidebar-desktop" style={{ display:"inline" }}>Export</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* ── Messages / Welcome ── */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 0" }}>
          <div style={{ maxWidth:800, margin:"0 auto", padding:"0 16px", display:"flex", flexDirection:"column", minHeight:"100%" }}>
            {chat.messages.length === 0 && !chat.fileInfo ? (
              <Welcome fileRef={fileRef} />
            ) : (
              <>
                {chat.messages.map(m => <Msg key={m.id} m={m} />)}
                {isAsking && (
                  <div style={{ display:"flex", gap:12, padding:"10px 0", alignItems:"flex-start" }}>
                    <div style={{ width:32, height:32, borderRadius:10, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 16px var(--accent-glow)" }}>
                      {icon(I.Star, 14)}
                    </div>
                    <Typing />
                  </div>
                )}
              </>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* ── Suggestions ── */}
        {chat.fileInfo && chat.messages.length <= 3 && (
          <div style={{ display:"flex", justifyContent:"center", gap:6, padding:"0 16px 8px", flexWrap:"wrap" }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => { setQuestion(s.text); }} className="anim-fadeIn" style={{
                padding:"7px 14px", borderRadius:20, background:"var(--bg-surface)", border:"1px solid var(--border)",
                color:"var(--text-2)", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:5, transition:"all 0.2s",
                animationDelay:`${i*0.06}s`,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-active)"; e.currentTarget.style.color = "var(--text)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-2)"; }}
              >
                {s.emoji} {s.text}
              </button>
            ))}
          </div>
        )}

        {/* ── Upload Error ── */}
        {uploadError && (
          <div className="anim-slideUp" style={{ margin:"0 16px 8px", maxWidth:800, marginLeft:"auto", marginRight:"auto", padding:"10px 14px", borderRadius:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.15)", fontSize:12, color:"var(--red)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            {uploadError}
            <button onClick={() => setUploadError(null)} style={{ background:"none", border:"none", color:"var(--red)", cursor:"pointer" }}>{icon(I.X, 12)}</button>
          </div>
        )}

        {/* ── Upload Progress ── */}
        {isUploading && (
          <div style={{ margin:"0 16px 8px", maxWidth:800, marginLeft:"auto", marginRight:"auto" }}>
            <div style={{ height:3, borderRadius:3, background:"var(--bg-surface)", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${uploadProgress}%`, background:"var(--grad)", borderRadius:3, transition:"width 0.3s" }}/>
            </div>
            <div style={{ fontSize:11, color:"var(--text-3)", textAlign:"center", marginTop:4 }}>Processing document... {Math.round(uploadProgress)}%</div>
          </div>
        )}

        {/* ── Input Bar ── */}
        <div style={{ padding:"8px 16px 16px", paddingBottom: isMobile ? "max(16px, env(safe-area-inset-bottom))" : 16, background:"linear-gradient(180deg, transparent 0%, rgba(11,11,16,0.9) 40%)" }}>
          <div style={{
            maxWidth:800, margin:"0 auto", display:"flex", alignItems:"flex-end", gap:8,
            background:"rgba(20,20,28,0.7)", backdropFilter:"blur(16px)", border:"1px solid var(--border)",
            borderRadius:16, padding:"5px 6px 5px 14px", transition:"border-color 0.2s",
            boxShadow:"0 4px 20px rgba(0,0,0,0.25)",
          }}
          onFocus={() => {}} /* could add focus ring */
          >
            <button onClick={() => fileRef.current?.click()} disabled={isUploading} style={{
              width:36, height:36, borderRadius:10, border:"none", background:"transparent",
              color:"var(--text-3)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--accent)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-3)"}
            >
              {icon(I.Clip, 18)}
            </button>

            <textarea ref={inputRef} value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
              placeholder={chat.fileInfo ? "Ask anything about your document..." : "Upload a PDF to start..."}
              rows={1} style={{
                flex:1, resize:"none", border:"none", outline:"none", background:"transparent",
                color:"var(--text)", fontSize:14, lineHeight:1.6, fontFamily:"'Inter',sans-serif",
                maxHeight:160, padding:"8px 0", minHeight:36,
              }}
            />

            <button onClick={handleAsk} disabled={!question.trim() || isAsking} style={{
              width:38, height:38, borderRadius:11, border:"none", flexShrink:0,
              background: question.trim() && !isAsking ? "var(--grad)" : "var(--bg-surface)",
              color: question.trim() && !isAsking ? "#fff" : "var(--text-3)",
              cursor: question.trim() && !isAsking ? "pointer" : "default",
              display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s",
              boxShadow: question.trim() && !isAsking ? "0 0 16px var(--accent-glow)" : "none",
            }}>
              {icon(I.Send, 15)}
            </button>
          </div>

          <div style={{ textAlign:"center", marginTop:8, fontSize:10, color:"var(--text-3)", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.06em" }}>
            ResearchAI Engine v3.0
          </div>
        </div>
      </main>

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept=".pdf" style={{ display:"none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
      />
    </div>
  );
}
