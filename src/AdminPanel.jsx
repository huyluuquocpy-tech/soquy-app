import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { ArrowLeft, UserPlus, Trash2, Loader2, RefreshCw, Copy, Check } from "lucide-react";

const INK = "#26362F";
const INK_SOFT = "#5C6B69";
const LINE = "#E4E0D6";
const PAPER = "#FBF9F3";
const GOLD = "#B8860B";

const genPassword = () => Math.random().toString(36).slice(-8) + "A1";

export default function AdminPanel({ onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(genPassword());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [users, setUsers] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [copied, setCopied] = useState(false);

  const callFn = async (payload) => {
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Có lỗi xảy ra");
    return json;
  };

  const loadUsers = async () => {
    setLoadingList(true);
    try {
      const json = await callFn({ action: "list" });
      setUsers(json.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email) {
      setError("Vui lòng nhập email khách hàng.");
      return;
    }
    setCreating(true);
    try {
      await callFn({ action: "create", email, password });
      setMessage(`Đã tạo tài khoản cho ${email}. Gửi email và mật khẩu này cho khách: ${password}`);
      setEmail("");
      setPassword(genPassword());
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (u) => {
    if (!confirm(`Xoá tài khoản ${u.email}? Khách sẽ không đăng nhập được nữa.`)) return;
    try {
      await callFn({ action: "delete", userId: u.id });
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const copyPassword = () => {
    navigator.clipboard?.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={18} /> Quay lại
        </button>
        <div style={styles.title}>Quản trị tài khoản</div>
        <div style={{ width: 70 }} />
      </div>

      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Tạo tài khoản mới cho khách</div>
          <form onSubmit={handleCreate} style={styles.form}>
            <input
              type="email"
              placeholder="Email khách hàng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect="off"
            />
            <div style={styles.passwordRow}>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...styles.input, flex: 1 }}
              />
              <button type="button" onClick={() => setPassword(genPassword())} style={styles.iconBtn} title="Tạo mật khẩu mới">
                <RefreshCw size={16} />
              </button>
              <button type="button" onClick={copyPassword} style={styles.iconBtn} title="Copy mật khẩu">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}
            {message && <div style={styles.messageBox}>{message}</div>}

            <button type="submit" style={styles.submitBtn} disabled={creating}>
              {creating ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
              Tạo tài khoản
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitleRow}>
            <div style={styles.cardTitle}>Danh sách tài khoản ({users ? users.length : "…"})</div>
            <button style={styles.refreshBtn} onClick={loadUsers} disabled={loadingList}>
              <RefreshCw size={14} className={loadingList ? "spin" : ""} />
            </button>
          </div>
          {loadingList && !users ? (
            <div style={styles.muted}>Đang tải…</div>
          ) : users && users.length === 0 ? (
            <div style={styles.muted}>Chưa có tài khoản khách nào.</div>
          ) : (
            <div style={styles.list}>
              {users?.map((u) => (
                <div key={u.id} style={styles.userRow}>
                  <div>
                    <div style={styles.userEmail}>{u.email}</div>
                    <div style={styles.userDate}>
                      Tạo lúc {new Date(u.created_at).toLocaleString("vi-VN")}
                    </div>
                  </div>
                  <button style={styles.deleteBtn} onClick={() => handleDelete(u)} title="Xoá tài khoản">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100dvh",
    background: PAPER,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 20px", borderBottom: `1px solid ${LINE}`, background: "#fff",
  },
  backBtn: {
    display: "flex", alignItems: "center", gap: 6,
    background: "none", border: "none", color: INK, fontSize: 14, cursor: "pointer",
  },
  title: { fontWeight: 700, fontSize: 16, color: INK },
  container: { maxWidth: 480, margin: "0 auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 },
  card: {
    background: "#fff", borderRadius: 16, padding: 20, border: `1px solid ${LINE}`,
  },
  cardTitle: { fontWeight: 700, fontSize: 15, color: INK, marginBottom: 12 },
  cardTitleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  input: {
    padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${LINE}`,
    fontSize: 14, background: PAPER, color: INK, outline: "none",
  },
  passwordRow: { display: "flex", gap: 8, alignItems: "center" },
  iconBtn: {
    padding: 10, borderRadius: 10, border: `1.5px solid ${LINE}`,
    background: "#fff", color: INK, cursor: "pointer", display: "flex",
  },
  submitBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "13px 0", borderRadius: 12, border: "none", background: GOLD,
    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4,
  },
  errorBox: { background: "#FBE4E1", color: "#B3261E", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 },
  messageBox: { background: "#E3F2E9", color: "#1F7A5C", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 },
  muted: { color: INK_SOFT, fontSize: 13.5, padding: "8px 0" },
  refreshBtn: {
    background: "none", border: `1px solid ${LINE}`, borderRadius: 8, padding: 6, cursor: "pointer", color: INK,
  },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  userRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "10px 12px", borderRadius: 10, background: PAPER, border: `1px solid ${LINE}`,
  },
  userEmail: { fontSize: 13.5, color: INK, fontWeight: 600 },
  userDate: { fontSize: 11.5, color: INK_SOFT, marginTop: 2 },
  deleteBtn: {
    background: "none", border: "none", color: "#B3261E", cursor: "pointer", padding: 6,
  },
};
