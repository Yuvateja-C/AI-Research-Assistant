import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import jsPDF from "jspdf";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  CONSTANTS & HELPERS                         */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");

const uid = () => Math.random().toString(36).substring(2, 11);

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
/*  SVG ICONS SYSTEM                            */
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
  Edit: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  User: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Sun: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  Moon: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  Settings: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  Book: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a1 1 0 0 1 1-1h13.5a1 1 0 0 1 1 1v19M9 6h6M9 10h6"/></svg>,
  Check: (p) => <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
};
const icon = (Comp, s = 16) => <Comp width={s} height={s} style={{ flexShrink: 0 }} />;

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  SUB-COMPONENTS                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const Orbs = () => (
  <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
    <div style={{ position:"absolute", width:550, height:550, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,91,245,0.09) 0%, transparent 70%)", top:"-8%", right:"-6%", animation: "float1 20s infinite ease-in-out" }}/>
    <div style={{ position:"absolute", width:650, height:650, borderRadius:"50%", background:"radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)", bottom:"-12%", left:"-8%", animation: "float2 25s infinite ease-in-out" }}/>
  </div>
);

const Typing = () => (
  <div style={{ display:"flex", gap:14, padding:"12px 0", alignItems:"flex-start" }} className="anim-fadeIn">
    <div style={{
      width:32, height:32, borderRadius:12, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
      background:"var(--grad)", boxShadow:"0 0 16px var(--accent-glow)", color:"#fff"
    }}>
      {icon(I.Star, 12)}
    </div>
    <div style={{
      padding:"14px 20px", borderRadius:"20px 20px 20px 4px",
      background:"rgba(20, 20, 28, 0.4)", backdropFilter:"blur(12px)", border:"1px solid var(--border)",
      display:"flex", alignItems:"center", gap:6
    }}>
      <span style={{ fontSize: 12, color: "var(--text-3)", marginRight: 4 }}>Reasoning</span>
      <span style={{ width:5, height:5, borderRadius:"50%", background:"var(--accent)", animation:"typingDot 1.4s infinite 0s" }}/>
      <span style={{ width:5, height:5, borderRadius:"50%", background:"var(--accent)", animation:"typingDot 1.4s infinite 0.2s" }}/>
      <span style={{ width:5, height:5, borderRadius:"50%", background:"var(--accent)", animation:"typingDot 1.4s infinite 0.4s" }}/>
    </div>
  </div>
);

const Msg = ({ m, onSelectSource }) => {
  const u = m.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(m.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="anim-slideUp" style={{ display:"flex", gap:14, padding:"12px 0", flexDirection: u ? "row-reverse" : "row", alignItems:"flex-start" }}>
      <div style={{
        width:32, height:32, borderRadius:12, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff",
        background: u ? "rgba(255,255,255,0.06)" : "var(--grad)",
        boxShadow: u ? "none" : "0 0 16px var(--accent-glow)",
        border: "1px solid var(--border)"
      }}>
        {u ? "Y" : icon(I.Star, 12)}
      </div>
      <div style={{
        maxWidth:"80%", padding:"16px 20px", borderRadius: u ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
        background: u ? "rgba(124, 91, 245, 0.06)" : "rgba(20, 20, 28, 0.4)", 
        backdropFilter: "blur(12px)",
        border: `1px solid ${u ? "rgba(124, 91, 245, 0.15)" : "rgba(255, 255, 255, 0.04)"}`,
        fontSize:14, lineHeight:1.8, color:"var(--text)", whiteSpace:"pre-wrap", wordBreak:"break-word",
        position: "relative"
      }}>
        {m.content}

        {/* Message Actions */}
        {!u && m.content && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, gap: 8 }}>
            <button
              onClick={handleCopy}
              style={{ background: "transparent", border: "none", color: "var(--text-3)", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        )}

        {/* Source Citations Panel */}
        {m.sources && m.sources.length > 0 && (
          <div style={{ marginTop:14, paddingTop:10, borderTop:"1px dashed var(--border)", display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:11, color:"var(--text-3)", display:"flex", alignItems:"center", gap:4 }}>{icon(I.Doc, 10)} Evidence Sources:</span>
            {m.sources.map((src, i) => {
              const srcName = typeof src === "object" ? (src.source || "Document Context") : (typeof src === "string" ? src : `Chunk ${src}`);
              return (
                <span
                  key={i}
                  onClick={() => onSelectSource && onSelectSource(src)}
                  style={{
                    fontSize:10, background:"rgba(124, 91, 245, 0.1)", border:"1px solid rgba(124, 91, 245, 0.2)",
                    color:"var(--accent)", padding:"3px 8px", borderRadius:6, cursor: "pointer", display: "flex", alignItems: "center", gap: 4
                  }}
                >
                  📄 {srcName}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/*  MAIN COMPONENT                              */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function HomeGPT() {
  const [theme, setTheme] = useState("dark");
  const [token, setToken] = useState(() => localStorage.getItem("session_token") || "");
  const [user, setUser] = useState(null);
  
  // Auth view toggles
  const [authMode, setAuthMode] = useState("login"); // login, register, recover, reset, verify_email
  const [authForm, setAuthForm] = useState({ email: "", username: "", password: "", code2fa: "", token: "", newPassword: "" });
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // Chats & Workspace
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Model Selector & Research Mode
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [researchGroundedMode, setResearchGroundedMode] = useState(true);
  const [persona, setPersona] = useState("default");
  const abortControllerRef = useRef(null);

  // Document Info
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Canvas Tabs
  const [canvasTab, setCanvasTab] = useState("lab"); // lab, insights, timeline

  // Sidebar & Drawers
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [docPanelOpen, setDocPanelOpen] = useState(true);
  const [selectedSourceDrawer, setSelectedSourceDrawer] = useState(null);

  // Reports
  const [reports, setReports] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Modals
  const [searchQuery, setSearchQuery] = useState("");
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // System alerts
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "info" }), 3500);
  };

  // Toggle Theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Keyboard Shortcuts (Ctrl+K search, Esc close modals)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen(prev => !prev);
      }
      if (e.key === "Escape") {
        setSearchModalOpen(false);
        setSettingsModalOpen(false);
        setSelectedSourceDrawer(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch available AI models
  useEffect(() => {
    fetch(`${API}/ai/models`)
      .then(res => res.json())
      .then(data => {
        if (data.models && data.models.length > 0) {
          setAvailableModels(data.models);
          const def = data.models.find(m => m.is_default);
          if (def) setSelectedModel(def.id);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch initial session state
  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const meRes = await fetch(`${API}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (meRes.status === 401) {
        throw new Error("Session expired");
      }
      if (!meRes.ok) {
        return; // Temporary server/network glitch, preserve session token
      }
      const meData = await meRes.json();
      if (meData.user) {
        setUser(meData.user);
      }

      // Load User Chats
      const chatRes = await fetch(`${API}/chats`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (chatRes.ok) {
        const chatList = await chatRes.json();
        if (Array.isArray(chatList)) {
          setChats(chatList);
          setActiveChatId(prevId => {
            if (prevId && chatList.some(c => c.id === prevId)) return prevId;
            return chatList.length > 0 ? chatList[0].id : "";
          });
        }
      }

      // Load Reports
      const repRes = await fetch(`${API}/reports`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (repRes.ok) {
        const repList = await repRes.json();
        if (Array.isArray(repList)) {
          setReports(repList);
        }
      }
    } catch (e) {
      localStorage.removeItem("session_token");
      setToken("");
      setUser(null);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Active Chat Messages
  useEffect(() => {
    if (!token || !activeChatId) return;
    const curr = chats.find(c => c.id === activeChatId);
    setActiveChat(curr || null);

    fetch(`${API}/chats/${activeChatId}/messages`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(msgs => {
        if (Array.isArray(msgs)) setMessages(msgs);
      })
      .catch(() => {});
  }, [activeChatId, token, chats]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create Workspace Session
  const createNewWorkspace = async () => {
    try {
      const res = await fetch(`${API}/chats`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const newChat = await res.json();
        setChats(prev => [newChat, ...prev]);
        setActiveChatId(newChat.id);
        setMessages([]);
        showToast("Created new research workspace", "success");
      }
    } catch (e) {
      showToast("Failed to create chat workspace", "error");
    }
  };

  // Delete Workspace
  const deleteWorkspace = async (id) => {
    try {
      const res = await fetch(`${API}/chats/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setChats(prev => prev.filter(c => c.id !== id));
        if (activeChatId === id) setActiveChatId("");
        showToast("Deleted chat session", "info");
      }
    } catch (e) {}
  };

  // File Upload Handler
  const handleFileUpload = async (file) => {
    if (!file || !activeChatId) {
      if (!activeChatId) showToast("Please select or create a research workspace first.", "warning");
      return;
    }
    setUploading(true);
    setUploadProgress(10);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/upload?filename=${encodeURIComponent(file.name)}&chat_id=${activeChatId}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 90);
        setUploadProgress(10 + pct);
      }
    };

    xhr.onload = async () => {
      setUploading(false);
      setUploadProgress(0);
      if (xhr.status === 200) {
        try {
          const resp = JSON.parse(xhr.responseText);
          showToast(`Ingested ${resp.filename} successfully (${resp.total_chunks} chunks indexed)`, "success");
          loadData();
        } catch(pe) {
          showToast("Document processed successfully.", "success");
          loadData();
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          const errMsg = err.error?.message || err.detail || "Ingestion failed.";
          showToast(errMsg, "error");
        } catch(pe) {
          showToast("Ingestion failed on backend server.", "error");
        }
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress(0);
      showToast("Network error occurred during document upload.", "error");
    };

    xhr.ontimeout = () => {
      setUploading(false);
      setUploadProgress(0);
      showToast("Document upload timed out.", "error");
    };

    xhr.send(file);
  };

  // Stop Stream Generation
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setChatLoading(false);
      showToast("Generation cancelled by user.", "info");
    }
  };

  // Query Chat (RAG)
  const askQuestion = async (e) => {
    if (e) e.preventDefault();
    if (!question.trim() || !activeChatId || chatLoading) return;

    const qText = question;
    setQuestion("");
    setChatLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Optimistically add user message
    setMessages(prev => [...prev, { id: uid(), role: "user", content: qText }]);

    // Trigger auto-title generation if first message
    if (messages.length === 0) {
      fetch(`${API}/chats/${activeChatId}/generate-title`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ question: qText })
      }).then(r => r.json()).then(data => {
        if (data.title) {
          setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, title: data.title } : c));
        }
      }).catch(() => {});
    }

    try {
      const res = await fetch(`${API}/chats/${activeChatId}/ask`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          question: qText,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          persona: persona,
          model_id: selectedModel
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const errorMsg = errJson.error?.message || errJson.detail || "Query endpoint failure";
        throw new Error(errorMsg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      const assistantMsgId = uid();
      setMessages(prev => [...prev, { id: assistantMsgId, role: "assistant", content: "", sources: [] }]);

      let textAccumulator = "";
      let sourcesAccumulator = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const rawString = decoder.decode(value);
        const lines = rawString.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.substring(6).trim();
            if (dataStr === "[DONE]") break;
            
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.sources) {
                sourcesAccumulator = parsed.sources;
              }
              if (parsed.text) {
                textAccumulator += parsed.text;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, content: textAccumulator, sources: sourcesAccumulator }
                      : m
                  )
                );
              }
            } catch(e){}
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        showToast(err.message || "Response streaming error", "error");
      }
    } finally {
      setChatLoading(false);
      abortControllerRef.current = null;
      loadData();
    }
  };

  // Generate PDF Report
  const generateReport = async () => {
    if (!activeChatId || reportLoading) return;
    setReportLoading(true);
    showToast("Compiling comprehensive research report...");

    try {
      const res = await fetch(`${API}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ chat_id: activeChatId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.detail || "Report compilation failed");

      // Generate jsPDF download
      const doc = new jsPDF("p", "pt", "a4");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text(data.title || "Research Report", 40, 60);

      doc.setFontSize(10);
      doc.setFont("Helvetica", "oblique");
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated by ResearchAI Workspace — Grounded Evidence Rating: High`, 40, 80);

      let cursorY = 120;
      const addSection = (title, text) => {
        if (!text) return;
        if (cursorY > 740) {
          doc.addPage();
          cursorY = 60;
        }
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(99, 102, 241);
        doc.text(title, 40, cursorY);
        cursorY += 18;

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(71, 85, 105);
        const splitText = doc.splitTextToSize(text, 515);
        doc.text(splitText, 40, cursorY);
        cursorY += (splitText.length * 15) + 30;
      };

      addSection("EXECUTIVE SUMMARY", data.executive_summary);
      addSection("RESEARCH OVERVIEW", data.research_overview);
      addSection("DETAILED ANALYSIS", data.detailed_analysis);
      addSection("KEY FINDINGS", data.key_findings);
      addSection("AI STRATEGIC INSIGHTS", data.ai_insights);
      addSection("RECOMMENDATIONS", data.recommendations);
      addSection("CONCLUSION", data.conclusion);

      doc.save(`${(data.title || "Research_Report").replace(/\s+/g, "_")}.pdf`);
      showToast("Report compiled and downloaded as PDF!", "success");
      loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setReportLoading(false);
    }
  };

  // Auth Submit Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    if (authMode === "login") {
      try {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username_or_email: authForm.email,
            password: authForm.password,
            code_2fa: authForm.code2fa
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || data.detail || "Authentication failed");
        
        if (data.requires_2fa) {
          setAuthMessage("2FA verification required. Please enter your code.");
          return;
        }

        if (!data.token) throw new Error("No authentication token received from server");

        localStorage.setItem("session_token", data.token);
        setToken(data.token);
        if (data.user) {
          setUser(data.user);
        }
        const displayName = data.user?.name || data.user?.username || authForm.email;
        showToast(`Welcome back, ${displayName}!`, "success");
      } catch (err) {
        setAuthError(err.message);
      }
    } else if (authMode === "register") {
      try {
        const res = await fetch(`${API}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: authForm.email,
            username: authForm.username,
            password: authForm.password
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || data.detail || "Registration failed");

        setAuthMessage("Registration successful! Setting up workspace...");

        // Auto login
        const lRes = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username_or_email: authForm.email, password: authForm.password })
        });
        const lData = await lRes.json();
        if (lRes.ok && lData.token) {
          localStorage.setItem("session_token", lData.token);
          setToken(lData.token);
          if (lData.user) {
            setUser(lData.user);
          }
          showToast("Account created successfully!", "success");
        } else {
          setAuthMode("login");
          setAuthMessage("Account created! Please sign in with your credentials.");
        }
      } catch (err) {
        setAuthError(err.message);
      }
    }
  };

  const handleLogout = async () => {
    const currentToken = token;
    localStorage.removeItem("session_token");
    setToken("");
    setUser(null);
    setChats([]);
    setMessages([]);
    setActiveChatId("");
    setActiveChat(null);
    showToast("Logged out successfully", "info");

    if (currentToken) {
      try {
        await fetch(`${API}/auth/logout`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${currentToken}` }
        });
      } catch (e) {}
    }
  };

  // Group chats by date
  const chatGroups = useMemo(() => {
    const groups = {};
    chats.forEach(c => {
      const grp = dateGroup(c.createdAt || c.created_at);
      if (!groups[grp]) groups[grp] = [];
      groups[grp].push(c);
    });
    return groups;
  }, [chats]);

  const activeChatMetadata = useMemo(() => {
    if (!activeChat || !activeChat.file_info) return null;
    try {
      return typeof activeChat.file_info === "string" ? JSON.parse(activeChat.file_info) : activeChat.file_info;
    } catch(e) { return null; }
  }, [activeChat]);

  // Filtered items for Search Modal
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return chats.filter(c => (c.title || "").toLowerCase().includes(q));
  }, [searchQuery, chats]);

  // ----------------------------------------------------
  // UNAUTHENTICATED AUTH SCREEN
  // ----------------------------------------------------
  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <Orbs />
        <div className="anim-scaleIn" style={{
          width: 440, padding: 36, borderRadius: 24, background: "rgba(14, 14, 20, 0.75)",
          backdropFilter: "blur(20px)", border: "1px solid var(--border)", zIndex: 10,
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
        }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, background: "var(--grad)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
              margin: "0 auto 14px", boxShadow: "0 0 20px var(--accent-glow)"
            }}>
              {icon(I.Star, 22)}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>ResearchAI Workspace</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
              Intelligent 100% Free AI Research & Evidence Platform
            </p>
          </div>

          {authError && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#ef4444", fontSize: 12, marginBottom: 16 }}>
              {authError}
            </div>
          )}
          {authMessage && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", color: "#22c55e", fontSize: 12, marginBottom: 16 }}>
              {authMessage}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {authMode === "register" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 4, display: "block" }}>Username</label>
                <input
                  type="text" required value={authForm.username} onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                  placeholder="researcher_john"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "#fff", outline: "none", fontSize: 14 }}
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 4, display: "block" }}>Email Address</label>
              <input
                type="email" required value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                placeholder="name@university.edu"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "#fff", outline: "none", fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 4, display: "block" }}>Password</label>
              <input
                type="password" required value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                placeholder="••••••••"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "#fff", outline: "none", fontSize: 14 }}
              />
            </div>

            <button type="submit" style={{
              marginTop: 10, padding: 14, borderRadius: 12, background: "var(--grad)", border: "none", color: "#fff",
              fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px var(--accent-glow)"
            }}>
              {authMode === "login" ? "Sign In to Workspace" : "Create Free Account"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setAuthError(""); }}
              style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 13, cursor: "pointer" }}
            >
              {authMode === "login" ? "Don't have an account? Register free" : "Already registered? Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN WORKSPACE INTERFACE
  // ----------------------------------------------------
  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", position: "relative" }}>
      <Orbs />

      {/* Toast Notification */}
      {toast.show && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 10000, padding: "12px 18px", borderRadius: 12,
          background: toast.type === "error" ? "rgba(239, 68, 68, 0.9)" : toast.type === "success" ? "rgba(34, 197, 94, 0.9)" : "rgba(124, 91, 245, 0.9)",
          color: "#fff", fontSize: 13, fontWeight: 600, backdropFilter: "blur(10px)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
        }} className="anim-slideUp">
          {toast.message}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file" ref={fileInputRef} style={{ display: "none" }}
        onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
      />

      {/* Left Navigation Sidebar */}
      {sidebarOpen && (
        <aside className="workspace-aside-drawer" style={{
          width: 260, height: "100%", background: "var(--bg-sidebar)", borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column", zIndex: 20, flexShrink: 0
        }}>
          {/* Workspace Branding & New Chat */}
          <div style={{ padding: 18, borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                {icon(I.Star, 14)}
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>ResearchAI</span>
            </div>

            <button onClick={createNewWorkspace} style={{
              width: "100%", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border)", color: "#fff", fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", transition: "0.2s"
            }}>
              {icon(I.Plus, 14)} New Research Workspace
            </button>
          </div>

          {/* Quick Search Button */}
          <div style={{ padding: "12px 14px 4px" }}>
            <button onClick={() => setSearchModalOpen(true)} style={{
              width: "100%", padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer"
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{icon(I.Search, 12)} Search</span>
              <kbd style={{ fontSize: 10, background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>Ctrl K</kbd>
            </button>
          </div>

          {/* Sessions Scroll container */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 8px" }}>
            {Object.keys(chatGroups).map(group => (
              <div key={group} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 1, paddingLeft: 12, marginBottom: 8 }}>
                  {group}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {chatGroups[group].map(c => {
                    const isActive = c.id === activeChatId;
                    return (
                      <div key={c.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10,
                        background: isActive ? "rgba(255,255,255,0.03)" : "transparent",
                        border: isActive ? "1px solid var(--border)" : "1px solid transparent",
                        cursor: "pointer"
                      }} onClick={() => setActiveChatId(c.id)}>
                        <span style={{ fontSize: 13, color: isActive ? "#fff" : "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
                          {c.title || "New Research"}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); deleteWorkspace(c.id); }} style={{
                          background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", opacity: isActive ? 1 : 0
                        }}>
                          {icon(I.Trash, 12)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* User Profile Footer Card */}
          {user && (
            <div style={{ padding: 14, borderTop: "1px solid var(--border)", background: "rgba(0,0,0,0.15)", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 32, height: 32, borderRadius: 50, background: "var(--grad)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                {user.username.substring(0,2).toUpperCase()}
              </div>
              <div style={{ display: "flex", flexDirection: "column", overflow: "hidden", flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.name || user.username}
                </span>
                <span style={{ fontSize: 9, color: "var(--accent)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 1 }}>
                  Free Research Workspace
                </span>
              </div>
              <button onClick={() => setSettingsModalOpen(true)} style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer" }}>
                {icon(I.Settings, 14)}
              </button>
              <button onClick={handleLogout} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}>
                {icon(I.X, 14)}
              </button>
            </div>
          )}
        </aside>
      )}

      {/* Main Workspace Canvas */}
      <main style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-root)", position: "relative" }}>
        
        {/* Header Panel */}
        <header style={{
          height: 60, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 24px", backdropFilter: "blur(12px)", zIndex: 10
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer" }}>
              {icon(I.Sidebar, 16)}
            </button>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
              {activeChat ? activeChat.title : "Select Research Workspace"}
            </div>
            {activeChatMetadata && (
              <span style={{
                fontSize: 10, padding: "3px 8px", background: "rgba(124,91,245,0.08)", border: "1px solid rgba(124,91,245,0.2)",
                color: "var(--accent)", borderRadius: 6, textTransform: "capitalize"
              }}>
                📄 {activeChatMetadata.filename || "document"} Loaded
              </span>
            )}
          </div>

          {/* Header Controls: Canvas Tabs & Model Selector */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Model Selector Dropdown */}
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              style={{
                background: "rgba(124,91,245,0.08)", border: "1px solid rgba(124,91,245,0.25)",
                color: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, outline: "none", cursor: "pointer"
              }}
            >
              {availableModels.length > 0 ? (
                availableModels.map(m => (
                  <option key={m.id} value={m.id} style={{ background: "#14141c", color: "#fff" }}>
                    {m.name} ({m.speed})
                  </option>
                ))
              ) : (
                <option value="google/gemini-2.5-flash" style={{ background: "#14141c", color: "#fff" }}>Gemini 2.5 Flash</option>
              )}
            </select>

            {/* Toggle Theme Switcher */}
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer" }}>
              {theme === "dark" ? icon(I.Sun, 16) : icon(I.Moon, 16)}
            </button>

            <button onClick={() => setDocPanelOpen(!docPanelOpen)} style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer" }}>
              {icon(I.Doc, 16)}
            </button>
          </div>
        </header>

        {/* Workspace Canvas Body */}
        {activeChatId ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
            
            {/* Conversation Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
              {messages.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
                  <div style={{ width: 60, height: 60, borderRadius: 16, background: "rgba(124,91,245,0.05)", border: "1px solid rgba(124,91,245,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", marginBottom: 20 }}>
                    {icon(I.Brain, 28)}
                  </div>
                  <h4 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>What are you researching today?</h4>
                  <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 420, lineHeight: 1.6, marginBottom: 24 }}>
                    Ask research questions, upload papers or datasets, or extract evidence-backed summaries.
                  </p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                    {[
                      "Summarize methodology and key findings",
                      "Extract all statistical data and metrics",
                      "Analyze limitations and research gaps"
                    ].map((promptText, i) => (
                      <button
                        key={i}
                        onClick={() => { setQuestion(promptText); }}
                        style={{
                          padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)",
                          border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12, cursor: "pointer"
                        }}
                      >
                        {promptText}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => <Msg key={m.id || i} m={m} onSelectSource={setSelectedSourceDrawer} />)
              )}
              {chatLoading && <Typing />}
              <div ref={chatEndRef} />
            </div>

            {/* Context Memory Bar */}
            {activeChatMetadata && (
              <div style={{
                margin: "0 30px", padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--text-3)"
              }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                  <span>Active Document: <b>{activeChatMetadata.filename}</b></span>
                </div>
                <div style={{ display: "flex", gap: 14 }}>
                  <span>Words: {activeChatMetadata.word_count?.toLocaleString() || "0"}</span>
                  <span>Indexed Chunks: {activeChatMetadata.chunks || "0"}</span>
                </div>
              </div>
            )}

            {/* Input Composer Panel */}
            <form onSubmit={askQuestion} className="mobile-composer-bar" style={{ padding: "16px 30px 20px" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, background: "rgba(20,20,28,0.5)",
                border: "1px solid var(--border)", borderRadius: 16, padding: "8px 16px", backdropFilter: "blur(12px)"
              }}>
                {/* Upload File Clip button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer" }}
                  title="Attach document or dataset"
                >
                  {icon(I.Clip, 18)}
                </button>

                {/* Persona selector */}
                <select value={persona} onChange={e => setPersona(e.target.value)} style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-2)",
                  padding: "6px 8px", borderRadius: 8, fontSize: 12, outline: "none", cursor: "pointer"
                }}>
                  <option value="default" style={{ background: "#14141c", color: "#fff" }}>Default Persona</option>
                  <option value="summary" style={{ background: "#14141c", color: "#fff" }}>Summary Focus</option>
                  <option value="critique" style={{ background: "#14141c", color: "#fff" }}>Critique Methodology</option>
                  <option value="statistics" style={{ background: "#14141c", color: "#fff" }}>Extract Stats</option>
                </select>

                <input
                  type="text" placeholder="Ask a research question or inquire context..." value={question}
                  onChange={e => setQuestion(e.target.value)}
                  style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: 14, padding: "10px 4px", outline: "none" }}
                />

                {chatLoading ? (
                  <button
                    type="button" onClick={stopGeneration}
                    style={{
                      padding: "6px 14px", borderRadius: 8, background: "rgba(239, 68, 68, 0.15)",
                      border: "1px solid rgba(239, 68, 68, 0.4)", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer"
                    }}
                  >
                    ■ Stop
                  </button>
                ) : (
                  <button type="submit" style={{
                    width: 34, height: 34, borderRadius: 8, background: "var(--grad)", border: "none", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 0 10px var(--accent-glow)"
                  }}>
                    {icon(I.Send, 14)}
                  </button>
                )}
              </div>
            </form>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(124,91,245,0.05)", border: "1px solid rgba(124,91,245,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", marginBottom: 20 }}>
              {icon(I.Star, 30)}
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Select or Create a Workspace</h3>
            <p style={{ fontSize: 13, color: "var(--text-3)", maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>
              Start your first research session to ask questions, upload files, and compile evidence reports.
            </p>
            <button onClick={createNewWorkspace} style={{
              padding: "12px 24px", borderRadius: 12, background: "var(--grad)", border: "none", color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px var(--accent-glow)"
            }}>
              + Create Research Workspace
            </button>
          </div>
        )}
      </main>

      {/* Right Cabinet Panel (Documents & Insights) */}
      {docPanelOpen && activeChatId && (
        <aside className="cabinet-aside-drawer" style={{
          width: 320, height: "100%", background: "var(--bg-sidebar)", borderLeft: "1px solid var(--border)",
          display: "flex", flexDirection: "column", zIndex: 20, flexShrink: 0
        }}>
          <div style={{ padding: 18, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Research Cabinet</span>
            <button onClick={() => setDocPanelOpen(false)} style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer" }}>
              {icon(I.X, 14)}
            </button>
          </div>

          <div style={{ padding: 18, flex: 1, overflowY: "auto" }}>
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 10 }}>
                Document Ingestion
              </span>

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed var(--border)", borderRadius: 14, padding: "20px 14px", textAlign: "center",
                  cursor: "pointer", background: "rgba(255,255,255,0.01)", transition: "0.2s"
                }}
              >
                {icon(I.Upload, 20)}
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginTop: 8 }}>Upload Research Document</div>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>PDF, DOCX, XLSX, IPYNB, CSV, TXT</div>
              </div>

              {uploading && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--accent)", marginBottom: 4 }}>Processing document context... ({uploadProgress}%)</div>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ width: `${uploadProgress}%`, height: "100%", background: "var(--grad)" }} />
                  </div>
                </div>
              )}
            </div>

            {/* Active Document Details */}
            {activeChatMetadata ? (
              <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{activeChatMetadata.filename}</div>
                <div style={{ fontSize: 11, color: "var(--text-2)", display: "flex", flexDirection: "column", gap: 4 }}>
                  <span>Status: <b style={{ color: "var(--green)" }}>Ready & Vector Indexed</b></span>
                  <span>Word Count: {activeChatMetadata.word_count?.toLocaleString() || "N/A"}</span>
                  <span>Indexed Chunks: {activeChatMetadata.chunks || "N/A"}</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "20px 0" }}>
                No document uploaded to this research session yet.
              </div>
            )}

            {/* Research Report Generator Button */}
            <div style={{ marginTop: 30 }}>
              <button
                onClick={generateReport} disabled={reportLoading || !activeChatMetadata}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 10, background: "var(--grad)", border: "none",
                  color: "#fff", fontSize: 12, fontWeight: 700, cursor: reportLoading || !activeChatMetadata ? "not-allowed" : "pointer",
                  opacity: reportLoading || !activeChatMetadata ? 0.5 : 1, boxShadow: "0 4px 12px var(--accent-glow)"
                }}
              >
                {reportLoading ? "Compiling PDF Report..." : "Compile PDF Research Report"}
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Global Search Modal (Ctrl+K) */}
      {searchModalOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 100
        }}>
          <div className="anim-scaleIn" style={{
            width: 520, borderRadius: 16, background: "#14141c", border: "1px solid var(--border)", padding: 20
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border)", pb: 12, marginBottom: 16 }}>
              {icon(I.Search, 16)}
              <input
                type="text" autoFocus placeholder="Search research sessions..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ flex: 1, background: "none", border: "none", color: "#fff", fontSize: 14, outline: "none" }}
              />
              <button onClick={() => setSearchModalOpen(false)} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }}>
                {icon(I.X, 14)}
              </button>
            </div>

            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {searchResults.length > 0 ? (
                searchResults.map(c => (
                  <div
                    key={c.id}
                    onClick={() => { setActiveChatId(c.id); setSearchModalOpen(false); }}
                    style={{ padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.02)", marginBottom: 6 }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{c.title || "Untitled Session"}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", padding: "20px 0" }}>
                  {searchQuery ? "No matching research sessions found." : "Type a query to search..."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsModalOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div className="anim-scaleIn" style={{
            width: 480, borderRadius: 20, background: "#14141c", border: "1px solid var(--border)", padding: 24
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Workspace Settings</h3>
              <button onClick={() => setSettingsModalOpen(false)} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }}>
                {icon(I.X, 16)}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6, display: "block" }}>Default Model</label>
                <select
                  value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "#fff", outline: "none" }}
                >
                  {availableModels.map(m => (
                    <option key={m.id} value={m.id} style={{ background: "#14141c" }}>{m.name} ({m.speed})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 6, display: "block" }}>Appearance</label>
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  style={{ padding: "10px 16px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "#fff", fontSize: 13, cursor: "pointer" }}
                >
                  Theme Mode: {theme === "dark" ? "Dark Mode 🌙" : "Light Mode ☀️"}
                </button>
              </div>

              <div style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", fontSize: 12, color: "var(--text-3)" }}>
                <div>Platform Status: <b style={{ color: "var(--green)" }}>100% Free Production</b></div>
                <div>Vector Engine: ChromaDB persistent collections</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Source Evidence Slide-over Drawer */}
      {selectedSourceDrawer && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
          display: "flex", justifyContent: "flex-end"
        }}>
          <div className="anim-fadeSlideRight" style={{
            width: 400, height: "100%", background: "#14141c", borderLeft: "1px solid var(--border)", padding: 24, display: "flex", flexDirection: "column"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Evidence Source Detail</h4>
              <button onClick={() => setSelectedSourceDrawer(null)} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer" }}>
                {icon(I.X, 16)}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 13, color: "var(--text-2)" }}>
              <div>Document Source: <b style={{ color: "#fff" }}>{typeof selectedSourceDrawer === "object" ? selectedSourceDrawer.source : selectedSourceDrawer}</b></div>
              <div>Relevance Level: <b style={{ color: "var(--accent)" }}>High Grounded Evidence</b></div>
              <div>Chunk Reference: <code style={{ fontSize: 11, background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>{typeof selectedSourceDrawer === "object" ? selectedSourceDrawer.chunk_id : "N/A"}</code></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
