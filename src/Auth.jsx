import { useState } from "react";
import { supabase } from "./lib/supabase";
import { Wallet, Loader2 } from "lucide-react";

const INK = "#26362F";
const INK_SOFT = "#5C6B63";
const LINE = "#E4E0D6";
const PAPER = "#FBF9F3";
const GOLD = "#B8860B";

// Chỉ đăng nhập — không cho khách tự đăng ký. Tài khoản do người quản lý (chủ app)
// tạo sẵn và cấp cho từng khách hàng.
export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
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
        <div style={styles.subtitle}>Đăng nhập để xem sổ quỹ của bạn</div>

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
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />

          {error && <div style={styles.errorBox}>{error}</div>}

          <button type="submit" style={styles.submitBtn} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : null}
            Đăng nhập
          </button>
        </form>

        <div style={styles.hint}>Chưa có tài khoản? Liên hệ để được cấp tài khoản.</div>
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
  hint: {
    width: "100%",
    marginTop: 14,
    textAlign: "center",
    color: INK_SOFT,
    fontSize: 12.5,
  },
  errorBox: {
    background: "#FBE4E1", color: "#B3261E",
    padding: "8px 12px", borderRadius: 8, fontSize: 12.5,
  },
};
