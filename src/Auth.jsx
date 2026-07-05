import { useState } from "react";
import { supabase } from "./lib/supabase";
import { Wallet, Loader2 } from "lucide-react";

const INK = "#26362F";
const INK_SOFT = "#5C6B63";
const LINE = "#E4E0D6";
const PAPER = "#FBF9F3";
const GOLD = "#B8860B";

export default function Auth() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (!email || !password) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu cần tối thiểu 6 ký tự.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Tạo tài khoản thành công! Nếu Supabase yêu cầu xác nhận email, hãy kiểm tra hộp thư rồi đăng nhập lại.");
      }
    } catch (err) {
      setError(err.message === "Invalid login credentials"
        ? "Sai email hoặc mật khẩu."
        : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logoBadge}><Wallet size={22} color="#fff" /></div>
          <div style={styles.title}>Sổ Quỹ</div>
        </div>
        <div style={styles.subtitle}>
          {mode === "login" ? "Đăng nhập để xem sổ quỹ của bạn" : "Tạo tài khoản mới"}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <input
            type="password"
            placeholder="Mật khẩu (tối thiểu 6 ký tự)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />

          {error && <div style={styles.errorBox}>{error}</div>}
          {message && <div style={styles.messageBox}>{message}</div>}

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : null}
            {mode === "login" ? "Đăng nhập" : "Đăng ký"}
          </button>
        </form>

        <button
          style={styles.switchBtn}
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setMessage(null); }}
        >
          {mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
        </button>
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
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: PAPER,
    padding: 20,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    background: "#fff",
    borderRadius: 20,
    padding: 28,
    border: `1px solid ${LINE}`,
    boxShadow: "0 10px 30px rgba(38,54,47,0.08)",
  },
  logoRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 },
  logoBadge: {
    width: 40, height: 40, borderRadius: 12,
    background: "linear-gradient(135deg, #4ADE94, #0B5C42)",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: 700, color: INK },
  subtitle: { fontSize: 13, color: INK_SOFT, margin: "10px 0 20px" },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  input: {
    padding: "12px 14px",
    borderRadius: 10,
    border: `1.5px solid ${LINE}`,
    fontSize: 14,
    background: PAPER,
    color: INK,
    outline: "none",
  },
  submitBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "13px 0",
    borderRadius: 12,
    border: "none",
    background: GOLD,
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 4,
  },
  switchBtn: {
    width: "100%",
    marginTop: 14,
    background: "none",
    border: "none",
    color: INK_SOFT,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
  },
  errorBox: {
    background: "#FBE4E1", color: "#B3261E",
    padding: "8px 12px", borderRadius: 8, fontSize: 12.5,
  },
  messageBox: {
    background: "#E3F2E9", color: "#1F7A5C",
    padding: "8px 12px", borderRadius: 8, fontSize: 12.5,
  },
};
