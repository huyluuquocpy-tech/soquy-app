# Sổ Quỹ — Web App quản lý thu chi cá nhân

App React, dữ liệu đồng bộ qua nhiều thiết bị bằng Supabase (đăng nhập email +
mật khẩu), triển khai miễn phí trên GitHub Pages, có thể "Thêm vào Màn hình
chính" trên iPhone để dùng như app thật.

---

## Bước 1 — Tạo project Supabase (miễn phí)

1. Vào https://supabase.com → **New project**. Đặt tên tuỳ ý, chọn vùng gần
   Việt Nam (Singapore), đặt mật khẩu database (lưu lại, không cần dùng sau).
2. Đợi project khởi tạo xong (~2 phút).
3. Vào **SQL Editor** → **New query**, dán đoạn SQL sau rồi bấm **Run**:

```sql
create table if not exists kv_store (
  user_id uuid not null default auth.uid(),
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table kv_store enable row level security;

create policy "select own rows" on kv_store
  for select using (auth.uid() = user_id);

create policy "insert own rows" on kv_store
  for insert with check (auth.uid() = user_id);

create policy "update own rows" on kv_store
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

4. Vào **Authentication → Providers → Email**. Nếu muốn đăng ký xong dùng
   được ngay (không cần xác nhận email), tắt **Confirm email**. Nếu để bật,
   người dùng sẽ phải bấm link xác nhận trong email trước khi đăng nhập được.
5. Vào **Project Settings → API**. Copy 2 giá trị:
   - **Project URL** → dùng cho `VITE_SUPABASE_URL`
   - **anon public key** → dùng cho `VITE_SUPABASE_ANON_KEY`

---

## Bước 2 — Đưa code lên GitHub

1. Tạo repo mới trên GitHub (ví dụ đặt tên `soquy-app` — **nếu bạn đặt tên
   khác, nhớ sửa lại**, xem Bước 3).
2. Trong thư mục project, chạy:

```bash
git init
git add .
git commit -m "Sổ Quỹ - phiên bản đầu"
git branch -M main
git remote add origin https://github.com/<username>/<ten-repo>.git
git push -u origin main
```

3. Vào repo trên GitHub → **Settings → Secrets and variables → Actions →
   New repository secret**, thêm 2 secret:
   - `VITE_SUPABASE_URL` = Project URL đã copy ở Bước 1
   - `VITE_SUPABASE_ANON_KEY` = anon public key đã copy ở Bước 1

4. Vào **Settings → Pages** → mục **Build and deployment → Source**, chọn
   **GitHub Actions**.

5. Workflow `.github/workflows/deploy.yml` đã có sẵn trong project — mỗi lần
   bạn `git push` lên nhánh `main`, GitHub sẽ tự build và deploy. Vào tab
   **Actions** để xem tiến trình. Sau khi chạy xong (~1-2 phút), app sẽ có ở:

```
https://<username>.github.io/<ten-repo>/
```

---

## Bước 3 — Nếu tên repo KHÔNG phải `soquy-app`

Mở file `vite.config.js`, sửa dòng:

```js
base: '/soquy-app/',
```

thành đúng tên repo của bạn, ví dụ `base: '/so-quy-cua-toi/'`, rồi commit và
push lại.

---

## Bước 4 — Chạy thử ở máy tính (không bắt buộc)

```bash
cp .env.example .env
# mở .env, dán VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào
npm install
npm run dev
```

---

## Bước 5 — Thêm vào Màn hình chính trên iPhone

1. Mở link app (`https://<username>.github.io/<ten-repo>/`) bằng **Safari**
   trên iPhone (bắt buộc là Safari, Chrome trên iOS không hỗ trợ mục này).
2. Bấm nút **Chia sẻ** (hình vuông có mũi tên đi lên) ở thanh dưới.
3. Kéo xuống chọn **Thêm vào MH chính** (Add to Home Screen).
4. Bấm **Thêm**. Icon "Sổ Quỹ" sẽ xuất hiện trên màn hình chính, mở lên sẽ
   chạy toàn màn hình như app thật (không thấy thanh địa chỉ Safari).

Mỗi người dùng cần **đăng ký tài khoản riêng** (email + mật khẩu) ngay trong
app — dữ liệu của mỗi tài khoản tách biệt và tự đồng bộ khi đăng nhập trên
thiết bị khác.

---

## Cấu trúc project

```
src/
  App.jsx         # Cổng xác thực: hiện Auth hoặc SoQuy
  Auth.jsx        # Màn hình đăng nhập / đăng ký
  SoQuy.jsx       # App quản lý thu chi (component gốc của bạn)
  lib/
    supabase.js   # Khởi tạo Supabase client
    dataStore.js  # Lớp lưu trữ, thay cho window.storage cũ — lưu qua bảng kv_store
public/
  icons/          # Icon app (đã tạo sẵn, phong cách sổ + đồng xu vàng)
  manifest.webmanifest
.github/workflows/deploy.yml   # Tự build & deploy khi push lên main
```

Toàn bộ tính năng gốc (nhập giao dịch, sổ cái, báo cáo, ngân sách, định kỳ,
xuất Excel) giữ nguyên — chỉ thay phần lưu trữ để đồng bộ nhiều thiết bị.
