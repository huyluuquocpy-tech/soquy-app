// Edge Function: create-user
// Cho phép DUY NHẤT tài khoản admin (email trùng với secret ADMIN_EMAIL) tạo tài khoản mới
// cho khách hàng, hoặc xem danh sách tài khoản đã có. Chìa khoá "service_role" (toàn quyền)
// chỉ tồn tại ở đây, trên máy chủ, KHÔNG BAO GIỜ gửi về trình duyệt.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    // Xác định người gọi hàm này là ai (dựa vào token đăng nhập của họ)
    const supabaseAsCaller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await supabaseAsCaller.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Chưa đăng nhập." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
    if (!ADMIN_EMAIL || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return new Response(JSON.stringify({ error: "Bạn không có quyền thực hiện thao tác này." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client dùng service_role — toàn quyền, chỉ dùng ở phía máy chủ này
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action || "create";

    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      const users = data.users
        .map((u) => ({ id: u.id, email: u.email, created_at: u.created_at }))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return new Response(JSON.stringify({ ok: true, users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { userId } = body;
      if (!userId) throw new Error("Thiếu userId");
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action === "create"
    const { email, password } = body;
    if (!email || !password || String(password).length < 6) {
      return new Response(JSON.stringify({ error: "Thiếu email hoặc mật khẩu (tối thiểu 6 ký tự)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // khách có thể đăng nhập ngay, không cần xác nhận email
    });
    if (error) throw error;

    return new Response(
      JSON.stringify({ ok: true, user: { id: data.user.id, email: data.user.email } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
