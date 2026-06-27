import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import jsPDF from "jspdf";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  CONSTANTS & HELPERS                         */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

const relativeTime = (ts) => {
  if (!ts) return "";
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
  if (!ts) return "Today";
  const now = new Date();
  const d = new Date(ts);
  const diff = Math.floor((now.setHours(0,0,0,0) - new Date(d).setHours(0,0,0,0)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "Previous 7 Days";
  if (diff < 30) return "This Month";
  return "Older";
};

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
  StarOutline: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
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
  Edit: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Archive: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
  Lock: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  User: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};
const icon = (Comp, s = 16) => <Comp width={s} height={s} style={{ flexShrink: 0 }} />;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  SUB-COMPONENTS                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const Orbs = () => (
  <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
    <div style={{ position:"absolute", width:550, height:550, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,91,245,0.08) 0%, transparent 70%)", top:"-8%", right:"-6%" }}/>
    <div style={{ position:"absolute", width:650, height:650, borderRadius:"50%", background:"radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)", bottom:"-12%", left:"-8%" }}/>
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
        background: u ? "rgba(124,91,245,0.08)" : "var(--bg-surface)", border: `1px solid ${u ? "rgba(124,91,245,0.15)" : "var(--border)"}`,
        fontSize:14, lineHeight:1.75, color:"var(--text)", whiteSpace:"pre-wrap", wordBreak:"break-word",
      }}>
        {m.content}
        {m.sources?.length > 0 && (
          <div style={{ marginTop:10, paddingTop:8, borderTop:"1px solid var(--border)", display:"flex", flexWrap:"wrap", gap:5 }}>
            {m.sources.map((s,i) => (
              <span key={i} style={{ fontSize:10, padding:"2px 8px", borderRadius:12, background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)", color:"var(--accent-2)", fontFamily:"'JetBrains Mono',monospace" }}>
                Source {s.chunk_index ?? i+1}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FEATS = [
  { icon: I.Upload, title: "10 GB uploads supported", desc: "Process huge PDF research documents seamlessly", color: "#7c5bf5" },
  { icon: I.Brain, title: "Deep Vector Search", desc: "Contextual RAG answering using Gemini and ChromaDB", color: "#3b82f6" },
  { icon: I.Chart, title: "Smart Categories", desc: "Filter and manage research by custom categories & tags", color: "#f59e0b" },
  { icon: I.Shield, title: "Secured Credentials", desc: "Full session handling, optional 2FA, and password encryption", color: "#22c55e" },
];

const Welcome = ({ onUpload, fileRef }) => (
  <div className="anim-fadeIn" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, padding:"40px 20px", textAlign:"center" }}>
    <div style={{ width:56, height:56, borderRadius:16, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20, boxShadow:"0 0 30px var(--accent-glow)" }}>
      {icon(I.Star, 24)}
    </div>
    <h2 style={{ fontSize:28, fontWeight:800, background:"linear-gradient(135deg, var(--text), var(--text-2))", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:8, letterSpacing:"-0.03em" }}>
      ResearchAI Workspace
    </h2>
    <p style={{ fontSize:15, color:"var(--text-2)", maxWidth:460, marginBottom:36, lineHeight:1.7 }}>
      Upload your PDF study materials and research papers. Ask questions, build tags, and export findings effortlessly.
    </p>

    {/* Feature Grid */}
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:12, maxWidth:680, width:"100%", marginBottom:32 }}>
      {FEATS.map((f, i) => (
        <div key={i} style={{
          padding:"20px 16px", borderRadius:16, background:"var(--bg-surface)", border:"1px solid var(--border)",
          textAlign:"left", cursor:"default"
        }}>
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
    }}>
      {icon(I.Upload, 18)} Upload PDF Document
    </button>
  </div>
);

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  MAIN APP COMPONENT                          */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function HomeGPT() {
  /* Auth State */
  const [token, setToken] = useState(() => localStorage.getItem("session_token") || "");
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState("login"); // login, register, recover, reset_password, setup_2fa, verify_2fa
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code2fa, setCode2fa] = useState("");
  const [authError, setAuthError] = useState("");
  const [requires2fa, setRequires2fa] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryLink, setRecoveryLink] = useState("");
  const [resetToken, setResetToken] = useState("");

  /* App State */
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [search, setSearch] = useState("");
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  /* Tag & Filter state */
  const [selectedTagFilter, setSelectedTagFilter] = useState("All Tags");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all"); // all, active, archived, favorite
  const [addingTagId, setAddingTagId] = useState(null);
  const [newTagVal, setNewTagVal] = useState("");

  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const abortRefs = useRef({ upload: null, ask: null, summary: null });

  const activeChat = useMemo(() => chats.find(c => c.id === activeId) || null, [chats, activeId]);

  /* Verify Auth */
  const checkAuth = useCallback(async (currentTkn) => {
    if (!currentTkn) return;
    try {
      const r = await fetch(`${API}/auth/me`, {
        headers: { "Authorization": `Bearer ${currentTkn}` }
      });
      if (r.ok) {
        const d = await r.json();
        setUser(d.user);
        fetchChats(currentTkn);
      } else {
        handleLogoutAction();
      }
    } catch {
      handleLogoutAction();
    }
  }, []);

  useEffect(() => {
    if (token) {
      checkAuth(token);
    }
  }, [token, checkAuth]);

  /* Fetch Chats */
  const fetchChats = async (tkn) => {
    try {
      const r = await fetch(`${API}/chats`, {
        headers: { "Authorization": `Bearer ${tkn}` }
      });
      if (r.ok) {
        const data = await r.json();
        setChats(data);
        if (data.length > 0 && !activeId) {
          setActiveId(data[0].id);
          fetchMessages(data[0].id, tkn);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async (chatId, tkn) => {
    try {
      const r = await fetch(`${API}/chats/${chatId}/messages`, {
        headers: { "Authorization": `Bearer ${tkn}` }
      });
      if (r.ok) {
        const msgs = await r.json();
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, messages: msgs } : c));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const h = () => { setIsMobile(window.innerWidth <= 768); if (window.innerWidth > 768) setSidebarOpen(true); };
    window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
  }, []);

  useEffect(() => {
    const ta = inputRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`; }
  }, [question]);

  /* Auth Handlers */
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username_or_email: email, password, code_2fa: code2fa })
      });
      const d = await r.json();
      if (!r.ok) {
        setAuthError(d.detail || "Login failed");
        return;
      }
      if (d.requires_2fa) {
        setRequires2fa(true);
        setAuthError("Please input your 2FA authentication code.");
        return;
      }
      localStorage.setItem("session_token", d.token);
      setToken(d.token);
      setRequires2fa(false);
      setCode2fa("");
    } catch {
      setAuthError("Network connection failure");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const r = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password })
      });
      const d = await r.json();
      if (!r.ok) {
        setAuthError(d.detail || "Registration failed");
        return;
      }
      // Log in automatically after register
      const loginRes = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username_or_email: email, password })
      });
      const loginData = await loginRes.json();
      localStorage.setItem("session_token", loginData.token);
      setToken(loginData.token);
    } catch {
      setAuthError("Registration failed. Verify fields.");
    }
  };

  const handleRecovery = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const r = await fetch(`${API}/auth/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const d = await r.json();
      if (r.ok) {
        setRecoverySent(true);
        if (d.recovery_link) {
          setRecoveryLink(d.recovery_link);
        }
      } else {
        setAuthError(d.detail || "Recovery failed");
      }
    } catch {
      setAuthError("Network error");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const r = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, new_password: password })
      });
      if (r.ok) {
        setAuthView("login");
        setAuthError("Password successfully reset! You can now log in.");
      } else {
        const d = await r.json();
        setAuthError(d.detail || "Reset failed");
      }
    } catch {
      setAuthError("Error resetting password");
    }
  };

  const handleLogoutAction = () => {
    localStorage.removeItem("session_token");
    setToken("");
    setUser(null);
    setChats([]);
    setActiveId("");
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
    } catch {}
    handleLogoutAction();
  };

  /* Chat Actions */
  const handleCreateChat = async () => {
    try {
      const r = await fetch(`${API}/chats`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (r.ok) {
        const data = await r.json();
        const fresh = {
          id: data.id,
          title: data.title,
          file_info: null,
          summary: "",
          status: "active",
          tags: [],
          messages: []
        };
        setChats(prev => [fresh, ...prev]);
        setActiveId(data.id);
        if (isMobile) setSidebarOpen(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRenameChat = async (chatId, title) => {
    if (!title.trim()) return;
    try {
      const r = await fetch(`${API}/chats/${chatId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ title })
      });
      if (r.ok) {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, title } : c));
        setEditingChatId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleFavorite = async (c) => {
    const nextStatus = c.status === "favorite" ? "active" : "favorite";
    try {
      const r = await fetch(`${API}/chats/${c.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (r.ok) {
        setChats(prev => prev.map(ch => ch.id === c.id ? { ...ch, status: nextStatus } : ch));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleArchive = async (c) => {
    const nextStatus = c.status === "archived" ? "active" : "archived";
    try {
      const r = await fetch(`${API}/chats/${c.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (r.ok) {
        setChats(prev => prev.map(ch => ch.id === c.id ? { ...ch, status: nextStatus } : ch));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteChat = async (chatId, e) => {
    e.stopPropagation();
    try {
      const r = await fetch(`${API}/chats/${chatId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (r.ok) {
        setChats(prev => {
          const next = prev.filter(c => c.id !== chatId);
          if (activeId === chatId) {
            if (next.length > 0) {
              setActiveId(next[0].id);
              fetchMessages(next[0].id, token);
            } else {
              setActiveId("");
            }
          }
          return next;
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  /* Tags */
  const handleAddTag = async (chatId) => {
    const tag = newTagVal.trim();
    if (!tag) return;
    const target = chats.find(c => c.id === chatId);
    if (!target) return;
    const nextTags = [...new Set([...target.tags, tag])].join(",");
    try {
      const r = await fetch(`${API}/chats/${chatId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ tags: nextTags })
      });
      if (r.ok) {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, tags: nextTags.split(",") } : c));
        setNewTagVal("");
        setAddingTagId(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveTag = async (chatId, tagToRemove) => {
    const target = chats.find(c => c.id === chatId);
    if (!target) return;
    const nextTags = target.tags.filter(t => t !== tagToRemove).join(",");
    try {
      const r = await fetch(`${API}/chats/${chatId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ tags: nextTags })
      });
      if (r.ok) {
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, tags: nextTags ? nextTags.split(",") : [] } : c));
      }
    } catch (e) {
      console.error(e);
    }
  };

  /* Upload */
  const handleUpload = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) { setUploadError("Only PDF files supported."); return; }
    if (!activeId) {
      setUploadError("Please select or create a research chat session first.");
      return;
    }

    setUploadError(null); setIsUploading(true); setUploadProgress(0);
    const prog = setInterval(() => setUploadProgress(p => Math.min(p + Math.random() * 10, 95)), 400);

    const ctrl = new AbortController(); abortRefs.current.upload = ctrl;

    try {
      // Direct binary stream upload for huge 10 GB PDFs
      const res = await fetch(`${API}/upload?filename=${encodeURIComponent(file.name)}&chat_id=${activeId}`, {
        method: "POST",
        body: file,
        headers: { "Authorization": `Bearer ${token}` },
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error("Upload failed. Verify backend.");
      const data = await res.json();
      
      clearInterval(prog); setUploadProgress(100);
      setChats(prev => prev.map(c => c.id === activeId ? {
        ...c,
        file_info: { filename: data.filename, chunks: data.total_chunks },
        messages: [...(c.messages || []), {
          id: uid(), role: "assistant",
          content: `📄 **${data.filename}** uploaded successfully.\n📦 ${data.total_chunks} vector chunks indexed for search.\n\nAsk questions about the document below.`
        }]
      } : c));
      // Rename chat to filename if default name
      if (activeChat?.title === "New Research") {
        handleRenameChat(activeId, data.filename.replace(".pdf", ""));
      }
    } catch (e) {
      clearInterval(prog);
      if (e.name !== "AbortError") setUploadError(e.message);
    } finally { setIsUploading(false); setTimeout(() => setUploadProgress(0), 1000); }
  };

  /* Ask */
  const handleAsk = async () => {
    const q = question.trim(); if (!q || isAsking || !activeId) return;
    setQuestion("");
    
    // Add user msg locally
    setChats(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...(c.messages || []), { id: uid(), role: "user", content: q }] } : c));
    setIsAsking(true);

    const ctrl = new AbortController(); abortRefs.current.ask = ctrl;
    try {
      const hist = (activeChat?.messages || []).slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${API}/chats/${activeId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ question: q, history: hist }),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error("RAG request failed.");
      const d = await res.json();
      
      setChats(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...(c.messages || []), { id: uid(), role: "assistant", content: d.answer, sources: d.sources }] } : c));
      // Auto rename on first question if still default title
      if (activeChat?.title === "New Research") {
        handleRenameChat(activeId, q.slice(0, 35));
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setChats(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...(c.messages || []), { id: uid(), role: "assistant", content: "⚠️ Request failed. Reconnect to backend." }] } : c));
      }
    } finally { setIsAsking(false); }
  };

  /* Summary */
  const handleSummary = async () => {
    if (isGeneratingSummary || !activeId) return;
    setIsGeneratingSummary(true);
    try {
      const res = await fetch(`${API}/chats/${activeId}/summary`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setChats(prev => prev.map(c => c.id === activeId ? {
          ...c,
          summary: d.summary,
          messages: [...(c.messages || []), { id: uid(), role: "assistant", content: d.summary }]
        } : c));
      }
    } catch (e) {
      console.error(e);
    } finally { setIsGeneratingSummary(false); }
  };

  /* Export */
  const exportPDF = () => {
    if (!activeChat) return;
    const text = activeChat.summary || (activeChat.messages || []).filter(m => m.role === "assistant").map(m => m.content).join("\n\n---\n\n");
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(124, 91, 245);
    doc.text("ResearchAI Report", 20, 22);
    doc.setDrawColor(124, 91, 245); doc.setLineWidth(0.5); doc.line(20, 27, 190, 27);
    doc.setFont("Helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(30, 30, 30);
    doc.text(doc.splitTextToSize(text, 170), 20, 37);
    doc.save(`Research_${activeChat.title.replace(/\s+/g, "_")}.pdf`);
  };

  /* Filter Chats */
  const filteredChats = useMemo(() => {
    return chats.filter(c => {
      // Search matches title
      const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase());
      
      // Status matches status filter
      let matchesStatus = true;
      if (selectedStatusFilter === "archived") matchesStatus = c.status === "archived";
      else if (selectedStatusFilter === "favorite") matchesStatus = c.status === "favorite";
      else matchesStatus = c.status !== "archived"; // by default hide archived
      
      // Tag filter
      let matchesTag = true;
      if (selectedTagFilter !== "All Tags") {
        matchesTag = c.tags && c.tags.includes(selectedTagFilter);
      }
      
      return matchesSearch && matchesStatus && matchesTag;
    });
  }, [chats, search, selectedStatusFilter, selectedTagFilter]);

  const allAvailableTags = useMemo(() => {
    const set = new Set();
    chats.forEach(c => c.tags && c.tags.forEach(t => t && set.add(t)));
    return ["All Tags", ...set];
  }, [chats]);

  const grouped = useMemo(() => {
    const groups = {};
    filteredChats.forEach(c => {
      const g = dateGroup(c.updatedAt || c.createdAt);
      (groups[g] ||= []).push(c);
    });
    return groups;
  }, [filteredChats]);

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  /*  RENDER AUTH SCREEN                          */
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (!user) {
    return (
      <div style={{ display:"flex", minHeight:"100vh", background:"#0b0b10", alignItems:"center", justifyContent:"center", padding:20, position:"relative" }}>
        <Orbs />
        <div className="anim-scaleIn" style={{
          width:"100%", maxWidth:420, padding:32, borderRadius:24, background:"rgba(20,20,28,0.75)",
          backdropFilter:"blur(24px)", border:"1px solid var(--border)", zIndex:10, boxShadow:"0 10px 40px rgba(0,0,0,0.4)"
        }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:28 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14, boxShadow:"0 0 20px var(--accent-glow)" }}>
              {icon(I.Lock, 20)}
            </div>
            <h2 style={{ fontSize:22, fontWeight:800, color:"#fff", letterSpacing:"-0.02em" }}>ResearchAI Hub</h2>
            <p style={{ fontSize:13, color:"var(--text-2)", marginTop:4 }}>Secure research workspace portal</p>
          </div>

          {authError && (
            <div style={{ padding:"10px 14px", borderRadius:10, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)", color:"var(--red)", fontSize:12, marginBottom:16 }}>
              {authError}
            </div>
          )}

          {authView === "login" && (
            <form onSubmit={handleLogin} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Username or Email</label>
                <input required type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@domain.com"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Password</label>
                <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                />
              </div>
              {requires2fa && (
                <div className="anim-slideUp">
                  <label style={{ fontSize:11, fontWeight:600, color:"var(--accent)", textTransform:"uppercase", display:"block", marginBottom:6 }}>2FA Code (Default demo: 123456)</label>
                  <input required type="text" value={code2fa} onChange={e => setCode2fa(e.target.value)} placeholder="123456"
                    style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--accent-glow)", color:"#fff", outline:"none", fontSize:14, fontWeight:"bold", letterSpacing:"0.4em", textAlign:"center" }}
                  />
                </div>
              )}
              <button type="submit" style={{ width:"100%", padding:"12px", borderRadius:12, background:"var(--grad)", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 16px var(--accent-glow)", marginTop:8 }}>
                Authorize Access
              </button>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:10 }}>
                <span onClick={() => { setAuthView("register"); setAuthError(""); }} style={{ color:"var(--accent)", cursor:"pointer" }}>Create account</span>
                <span onClick={() => { setAuthView("recover"); setAuthError(""); }} style={{ color:"var(--text-2)", cursor:"pointer" }}>Forgot password?</span>
              </div>
            </form>
          )}

          {authView === "register" && (
            <form onSubmit={handleRegister} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Email Address</label>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@domain.com"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Username</label>
                <input required type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="myresearcher"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Password (Strong: min 8 char, digits & letters)</label>
                <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  style={{
                    width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)",
                    border: password.length >= 8 && /\d/.test(password) && /[a-zA-Z]/.test(password) ? "1px solid var(--green)" : "1px solid var(--border)",
                    color:"#fff", outline:"none", fontSize:14
                  }}
                />
              </div>
              <button type="submit" style={{ width:"100%", padding:"12px", borderRadius:12, background:"var(--grad)", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", marginTop:8 }}>
                Register Account
              </button>
              <div style={{ textAlign:"center", fontSize:12, marginTop:10 }}>
                <span onClick={() => { setAuthView("login"); setAuthError(""); }} style={{ color:"var(--accent)", cursor:"pointer" }}>Already have an account? Sign in</span>
              </div>
            </form>
          )}

          {authView === "recover" && (
            <form onSubmit={handleRecovery} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {!recoverySent ? (
                <>
                  <p style={{ fontSize:13, color:"var(--text-2)", marginBottom:6 }}>Input your registered email. We will generate a recovery link below.</p>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Email Address</label>
                    <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@domain.com"
                      style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                    />
                  </div>
                  <button type="submit" style={{ width:"100%", padding:"12px", borderRadius:12, background:"var(--grad)", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", marginTop:8 }}>
                    Generate Recovery Link
                  </button>
                </>
              ) : (
                <div style={{ textAlign:"center" }}>
                  <p style={{ fontSize:13, color:"var(--green)", marginBottom:16 }}>Recovery Token Successfully Generated!</p>
                  {recoveryLink && (
                    <div style={{ padding:10, background:"var(--bg-surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12, wordBreak:"break-all", marginBottom:14 }}>
                      <span style={{ color:"var(--accent)", cursor:"pointer", fontWeight:"bold" }} onClick={() => {
                        const tokenParam = recoveryLink.split("token=")[1];
                        setResetToken(tokenParam);
                        setAuthView("reset_password");
                        setAuthError("");
                      }}>
                        👉 Click here to reset your password (token: {recoveryLink.split("token=")[1]})
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div style={{ textAlign:"center", fontSize:12, marginTop:10 }}>
                <span onClick={() => { setAuthView("login"); setAuthError(""); setRecoverySent(false); }} style={{ color:"var(--accent)", cursor:"pointer" }}>Back to Login</span>
              </div>
            </form>
          )}

          {authView === "reset_password" && (
            <form onSubmit={handleResetPassword} style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:"var(--text-2)", textTransform:"uppercase", display:"block", marginBottom:6 }}>New Password</label>
                <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  style={{ width:"100%", padding:"10px 14px", borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"#fff", outline:"none", fontSize:14 }}
                />
              </div>
              <button type="submit" style={{ width:"100%", padding:"12px", borderRadius:12, background:"var(--grad)", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", marginTop:8 }}>
                Save New Password
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  /*  RENDER CHAT WORKSPACE                       */
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const sidebarW = 310;
  
  const SidebarContent = (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg-sidebar)", position:"relative" }}>
      {/* Brand Header */}
      <div style={{ padding:"16px 14px 10px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {icon(I.Star, 15)}
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:"var(--text)", letterSpacing:"-0.02em" }}>ResearchAI</div>
            <div style={{ fontSize:9, color:"var(--text-3)", letterSpacing:"0.06em", textTransform:"uppercase" }}>Workspace Hub</div>
          </div>
        </div>
        
        <button onClick={handleLogout} title="Log Out" style={{ width:28, height:28, borderRadius:6, background:"var(--bg-hover)", border:"none", color:"var(--text-2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          {icon(I.X, 14)}
        </button>
      </div>

      {/* User Information */}
      <div style={{ padding:"8px 12px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:26, height:26, borderRadius:"50%", background:"var(--bg-hover)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--accent)" }}>
          {icon(I.User, 12)}
        </div>
        <div style={{ flex:1, overflow:"hidden" }}>
          <div style={{ fontSize:12, fontWeight:600, color:"var(--text)", textOverflow:"ellipsis", overflow:"hidden" }}>@{user.username}</div>
        </div>
      </div>

      {/* New Research CTA */}
      <div style={{ padding:"10px 12px 2px" }}>
        <button onClick={handleCreateChat} style={{
          width:"100%", padding:"10px 14px", borderRadius:10, border:"1px dashed rgba(124,91,245,0.3)",
          background:"var(--grad-subtle)", color:"var(--text)", fontSize:13, fontWeight:600, cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8
        }}>
          {icon(I.Plus, 14)} New Research Chat
        </button>
      </div>

      {/* Filter Options */}
      <div style={{ padding:"6px 12px", display:"flex", flexDirection:"column", gap:6 }}>
        {/* Status filters */}
        <div style={{ display:"flex", background:"var(--bg-surface)", padding:2, borderRadius:8, border:"1px solid var(--border)" }}>
          {["all", "favorite", "archived"].map(st => (
            <button key={st} onClick={() => setSelectedStatusFilter(st)} style={{
              flex:1, padding:"4px 6px", fontSize:11, textTransform:"capitalize", border:"none", borderRadius:6, cursor:"pointer",
              background: selectedStatusFilter === st ? "var(--bg-hover)" : "transparent",
              color: selectedStatusFilter === st ? "var(--text)" : "var(--text-3)",
              fontWeight: selectedStatusFilter === st ? 600 : 500
            }}>
              {st}
            </button>
          ))}
        </div>

        {/* Tag Filters */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <select value={selectedTagFilter} onChange={e => setSelectedTagFilter(e.target.value)} style={{
            flex:1, padding:"6px 10px", borderRadius:8, background:"var(--bg-surface)", border:"1px solid var(--border)",
            color:"var(--text-2)", fontSize:11, outline:"none", cursor:"pointer"
          }}>
            {allAvailableTags.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ padding:"4px 12px 8px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", borderRadius:8, background:"var(--bg-surface)", border:"1px solid var(--border)" }}>
          <div style={{ color:"var(--text-3)" }}>{icon(I.Search, 13)}</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats..."
            style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"var(--text)", fontSize:12 }}
          />
        </div>
      </div>

      {/* Grouped Chat List */}
      <div style={{ flex:1, overflowY:"auto", padding:"4px 8px 8px" }}>
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <div style={{ fontSize:9, fontWeight:700, color:"var(--text-3)", letterSpacing:"0.08em", textTransform:"uppercase", padding:"10px 8px 4px" }}>{group}</div>
            {items.map(c => {
              const isActive = c.id === activeId;
              const isFav = c.status === "favorite";
              const isArchived = c.status === "archived";
              
              return (
                <div key={c.id} style={{ position:"relative", marginBottom:2 }}>
                  <button onClick={() => { setActiveId(c.id); fetchMessages(c.id, token); if (isMobile) setSidebarOpen(false); }}
                    style={{
                      width:"100%", padding:"10px 8px", borderRadius:8, border:"none", textAlign:"left",
                      background: isActive ? "var(--bg-active)" : "transparent",
                      borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                      cursor:"pointer", display:"flex", alignItems:"flex-start", gap:8, transition:"all 0.15s"
                    }}
                  >
                    <div style={{ width:24, height:24, borderRadius:6, background: isActive ? "var(--accent)15" : "var(--bg-surface)", display:"flex", alignItems:"center", justifyContent:"center", color: isActive ? "var(--accent)" : "var(--text-3)", flexShrink:0, marginTop:2 }}>
                      {icon(c.file_info ? I.File : I.Doc, 12)}
                    </div>
                    
                    <div style={{ flex:1, overflow:"hidden" }}>
                      {editingChatId === c.id ? (
                        <input
                          autoFocus
                          value={editTitleValue}
                          onChange={e => setEditTitleValue(e.target.value)}
                          onBlur={() => handleRenameChat(c.id, editTitleValue)}
                          onKeyDown={e => { if (e.key === "Enter") handleRenameChat(c.id, editTitleValue); }}
                          style={{ background:"var(--bg-root)", border:"1px solid var(--accent)", color:"#fff", fontSize:12, padding:"2px 6px", borderRadius:4, width:"95%" }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:12.5, fontWeight: isActive ? 600 : 500, color: isActive ? "var(--text)" : "var(--text-2)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {c.title}
                          </span>
                          {isFav && <span style={{ color:"var(--gold)", fontSize:10 }}>★</span>}
                          {isArchived && <span style={{ color:"var(--text-3)", fontSize:9, background:"var(--bg-surface)", padding:"1px 4px", borderRadius:3 }}>Archived</span>}
                        </div>
                      )}

                      {/* Tags row */}
                      {c.tags && c.tags.length > 0 && (
                        <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:4 }}>
                          {c.tags.map(t => t && (
                            <span key={t} style={{ fontSize:9, background:"rgba(124,91,245,0.08)", border:"1px solid rgba(124,91,245,0.15)", color:"var(--accent)", padding:"0px 5px", borderRadius:4, display:"flex", alignItems:"center", gap:2 }}>
                              {t}
                              <span onClick={(e) => { e.stopPropagation(); handleRemoveTag(c.id, t); }} style={{ color:"var(--red)", fontWeight:"bold", cursor:"pointer", marginLeft:2 }}>×</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                      <span style={{ fontSize:9, color:"var(--text-3)" }}>{relativeTime(c.updatedAt || c.createdAt)}</span>
                      
                      {/* Hover options */}
                      <div style={{ display:"flex", gap:3 }}>
                        <span onClick={(e) => { e.stopPropagation(); setEditingChatId(c.id); setEditTitleValue(c.title); }} title="Rename" style={{ color:"var(--text-3)", cursor:"pointer", padding:2 }}>
                          {icon(I.Edit, 10)}
                        </span>
                        <span onClick={(e) => { e.stopPropagation(); toggleFavorite(c); }} title={isFav ? "Unfavorite" : "Favorite"} style={{ color: isFav ? "var(--gold)" : "var(--text-3)", cursor:"pointer", padding:2 }}>
                          {icon(I.StarOutline, 10)}
                        </span>
                        <span onClick={(e) => { e.stopPropagation(); toggleArchive(c); }} title={isArchived ? "Unarchive" : "Archive"} style={{ color:"var(--text-3)", cursor:"pointer", padding:2 }}>
                          {icon(I.Archive, 10)}
                        </span>
                        <span onClick={(e) => handleDeleteChat(c.id, e)} title="Delete" style={{ color:"var(--red)", cursor:"pointer", padding:2 }}>
                          {icon(I.Trash, 10)}
                        </span>
                      </div>
                    </div>
                  </button>
                  
                  {/* Inline Tag Adder */}
                  <div style={{ padding:"0 8px 4px 34px" }}>
                    {addingTagId === c.id ? (
                      <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                        <input value={newTagVal} onChange={e => setNewTagVal(e.target.value)} placeholder="Add tag..."
                          style={{ background:"var(--bg-root)", border:"1px solid var(--border)", color:"#fff", fontSize:10, padding:"2px 5px", borderRadius:4, width:80 }}
                        />
                        <button onClick={() => handleAddTag(c.id)} style={{ padding:"2px 6px", fontSize:9, background:"var(--accent)", color:"#fff", border:"none", borderRadius:3, cursor:"pointer" }}>+</button>
                        <button onClick={() => setAddingTagId(null)} style={{ padding:"2px 6px", fontSize:9, background:"var(--bg-hover)", color:"var(--text-3)", border:"none", borderRadius:3, cursor:"pointer" }}>×</button>
                      </div>
                    ) : (
                      <span onClick={() => { setAddingTagId(c.id); setNewTagVal(""); }} style={{ fontSize:10, color:"var(--text-3)", cursor:"pointer", textDecoration:"underline" }}>+ add tag</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
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

      {/* ═══ MAIN WORKSPACE ═══ */}
      <main style={{ flex:1, display:"flex", flexDirection:"column", height:"100%", position:"relative", zIndex:5, overflow:"hidden" }}>

        {/* Top Header */}
        <header style={{
          display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px",
          background:"rgba(11,11,16,0.7)", backdropFilter:"blur(12px)", borderBottom:"1px solid var(--border)", minHeight:54,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} style={{ width:36, height:36, borderRadius:10, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"var(--text-2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {icon(I.Menu, 18)}
              </button>
            )}
            {!isMobile && (
              <button onClick={() => setSidebarOpen(p => !p)} style={{ width:34, height:34, borderRadius:9, background:"var(--bg-surface)", border:"1px solid var(--border)", color:"var(--text-2)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                {icon(I.Sidebar, 15)}
              </button>
            )}
            <div>
              <h1 style={{ fontSize:15, fontWeight:700, color:"var(--text)", letterSpacing:"-0.01em", lineHeight:1.2 }}>
                {activeChat ? activeChat.title : "Workspace"}
              </h1>
              {activeChat?.file_info ? (
                <div style={{ fontSize:11, color:"var(--text-3)" }}>
                  📄 {activeChat.file_info.filename} · {activeChat.file_info.chunks} vector chunks
                </div>
              ) : (
                <div style={{ fontSize:11, color:"var(--text-3)" }}>Ready for document upload</div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display:"flex", gap:6 }}>
            {activeChat?.file_info && (
              <>
                <button onClick={handleSummary} disabled={isGeneratingSummary} style={{
                  padding:"7px 14px", borderRadius:9, background:"var(--grad-subtle)", border:"1px solid var(--border-active)",
                  color:"#c4b5fd", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5
                }}>
                  {icon(I.Zap, 13)} <span>Summary</span>
                </button>
                <button onClick={exportPDF} style={{
                  padding:"7px 14px", borderRadius:9, background:"var(--bg-surface)", border:"1px solid var(--border)",
                  color:"var(--text-2)", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:5
                }}>
                  {icon(I.Down, 13)} <span>Export</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Message Panel */}
        <div style={{ flex:1, overflowY:"auto", padding:"12px 0" }}>
          <div style={{ maxWidth:800, margin:"0 auto", padding:"0 16px", display:"flex", flexDirection:"column", minHeight:"100%" }}>
            {!activeChat || ((activeChat.messages || []).length === 0 && !activeChat.file_info) ? (
              <Welcome fileRef={fileRef} />
            ) : (
              <>
                {(activeChat.messages || []).map(m => <Msg key={m.id} m={m} />)}
                {isAsking && (
                  <div style={{ display:"flex", gap:12, padding:"10px 0", alignItems:"flex-start" }}>
                    <div style={{ width:32, height:32, borderRadius:10, background:"var(--grad)", display:"flex", alignItems:"center", justifyContent:"center" }}>
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

        {/* Suggestions chips */}
        {activeChat?.file_info && (activeChat.messages || []).length <= 3 && (
          <div style={{ display:"flex", justifyContent:"center", gap:6, padding:"0 16px 8px", flexWrap:"wrap" }}>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => { setQuestion(s.text); }} style={{
                padding:"7px 14px", borderRadius:20, background:"var(--bg-surface)", border:"1px solid var(--border)",
                color:"var(--text-2)", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:5
              }}>
                {s.emoji} {s.text}
              </button>
            ))}
          </div>
        )}

        {/* Errors & Upload alerts */}
        {uploadError && (
          <div style={{ margin:"0 16px 8px", maxWidth:800, marginLeft:"auto", marginRight:"auto", padding:"10px 14px", borderRadius:10, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.15)", fontSize:12, color:"var(--red)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            {uploadError}
            <button onClick={() => setUploadError(null)} style={{ background:"none", border:"none", color:"var(--red)", cursor:"pointer" }}>{icon(I.X, 12)}</button>
          </div>
        )}

        {isUploading && (
          <div style={{ margin:"0 16px 8px", maxWidth:800, marginLeft:"auto", marginRight:"auto" }}>
            <div style={{ height:3, borderRadius:3, background:"var(--bg-surface)", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${uploadProgress}%`, background:"var(--grad)", borderRadius:3, transition:"width 0.3s" }}/>
            </div>
            <div style={{ fontSize:11, color:"var(--text-3)", textAlign:"center", marginTop:4 }}>Processing file stream page-by-page... {Math.round(uploadProgress)}%</div>
          </div>
        )}

        {/* Input area */}
        <div style={{ padding:"8px 16px 16px", paddingBottom: isMobile ? "max(16px, env(safe-area-inset-bottom))" : 16 }}>
          <div style={{
            maxWidth:800, margin:"0 auto", display:"flex", alignItems:"flex-end", gap:8,
            background:"rgba(20,20,28,0.7)", backdropFilter:"blur(16px)", border:"1px solid var(--border)",
            borderRadius:16, padding:"5px 6px 5px 14px", boxShadow:"0 4px 20px rgba(0,0,0,0.25)",
          }}>
            <button onClick={() => fileRef.current?.click()} disabled={isUploading || !activeId} style={{
              width:36, height:36, borderRadius:10, border:"none", background:"transparent",
              color: activeId ? "var(--text-3)" : "rgba(255,255,255,0.05)", cursor: activeId ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
            }}>
              {icon(I.Clip, 18)}
            </button>

            <textarea ref={inputRef} value={question} onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
              placeholder={activeChat?.file_info ? "Ask anything about your document..." : activeId ? "Upload a PDF document to start analyzing..." : "Please create a Chat Session first."}
              rows={1} style={{
                flex:1, resize:"none", border:"none", outline:"none", background:"transparent",
                color:"var(--text)", fontSize:14, lineHeight:1.6, fontFamily:"'Inter',sans-serif",
                maxHeight:160, padding:"8px 0", minHeight:36,
              }}
              disabled={!activeId}
            />

            <button onClick={handleAsk} disabled={!question.trim() || isAsking || !activeId} style={{
              width:38, height:38, borderRadius:11, border:"none", flexShrink:0,
              background: question.trim() && !isAsking && activeId ? "var(--grad)" : "var(--bg-surface)",
              color: question.trim() && !isAsking && activeId ? "#fff" : "var(--text-3)",
              cursor: question.trim() && !isAsking && activeId ? "pointer" : "default",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow: question.trim() && !isAsking && activeId ? "0 0 16px var(--accent-glow)" : "none",
            }}>
              {icon(I.Send, 15)}
            </button>
          </div>

          <div style={{ textAlign:"center", marginTop:8, fontSize:10, color:"var(--text-3)", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.06em" }}>
            ResearchAI Engine v3.0 · Supports uploads up to 10 GB
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
