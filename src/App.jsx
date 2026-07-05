import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./Auth";
import SoQuy from "./SoQuy";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = đang kiểm tra

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

  return session ? <SoQuy /> : <Auth />;
}
