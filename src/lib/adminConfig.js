// Email của chủ app — dùng để hiện nút "Quản trị" trên giao diện.
// ĐỔI thành đúng email bạn dùng để đăng nhập vào chính app Sổ Quỹ này.
// Lưu ý: đây chỉ là điều kiện hiển thị giao diện, không phải bảo mật thật sự —
// việc kiểm tra quyền admin thật sự nằm ở Edge Function (biến ADMIN_EMAIL đặt
// qua `supabase secrets set`), nên dù có sửa file này sai, người khác cũng
// không thể tạo/xoá tài khoản nếu email của họ không khớp secret phía server.
export const ADMIN_EMAIL = "huyluuquocpy@gmail.com";
