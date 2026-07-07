import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { ADMIN_EMAIL } from "./lib/adminConfig";
import Auth from "./Auth";
import SoQuy from "./SoQuy";
import AdminPanel from "./AdminPanel";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = đang kiểm tra
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", alignItems: "center",
        justifyContent: "center", fontFamily: "sans-serif", color: "#5C6B63",
      }}>
        Đang tải…
      </div>
    );
  }

  if (!session) return <Auth />;

  const isAdmin = !!(
    session.user?.email &&
    ADMIN_EMAIL &&
    session.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  if (showAdmin && isAdmin) {
    return <AdminPanel onBack={() => setShowAdmin(false)} />;
  }

  return <SoQuy isAdmin={isAdmin} onOpenAdmin={() => setShowAdmin(true)} />;
}
