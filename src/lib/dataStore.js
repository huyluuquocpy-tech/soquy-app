import { supabase } from "./supabase";

// dataStore giữ nguyên interface { get(key), set(key, value) } giống window.storage
// trong Claude Artifacts, nhưng lưu trữ thật qua bảng kv_store trên Supabase,
// gắn với user đang đăng nhập (đồng bộ được nhiều thiết bị).
// - get(key) trả về { key, value } (value là chuỗi JSON) hoặc null nếu chưa có
// - set(key, value) upsert bản ghi, value là chuỗi (thường là JSON.stringify(...))

export const dataStore = {
  async get(key) {
    const { data, error } = await supabase
      .from("kv_store")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) {
      console.error(`Lỗi đọc dữ liệu (${key}):`, error.message);
      return null;
    }
    if (!data) return null;
    return { key, value: data.value };
  },

  async set(key, value) {
    const { error } = await supabase
      .from("kv_store")
      .upsert(
        { key, value, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" }
      );

    if (error) {
      console.error(`Lỗi lưu dữ liệu (${key}):`, error.message);
      return null;
    }
    return { key, value };
  },
};
