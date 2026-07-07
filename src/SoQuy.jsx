import { useState, useEffect, useMemo, useCallback } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import { dataStore } from "./lib/dataStore";
import { supabase } from "./lib/supabase";
import {
  Plus, TrendingUp, TrendingDown, Wallet, Calendar,
  Download, Trash2, PenLine, X, ChevronDown, ChevronLeft, ChevronRight,
  AlertTriangle, Settings2, PiggyBank, Repeat, Power, Shield,
  Utensils, Car, Fuel, Home, Film, Gamepad2, Gift, HeartPulse,
  GraduationCap, ShoppingBag, Receipt, Plane, Shirt, Sparkles,
  PawPrint, Wrench, Banknote, TrendingUp as TrendingUpIcon,
  HandCoins, Baby, Coffee, Smartphone, Tag, MoreHorizontal,
} from "lucide-react";

// ---------- Helpers ----------
const fmt = (n) => {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("vi-VN");
};
// Chuyển 1 Date object thành chuỗi YYYY-MM-DD theo GIỜ ĐỊA PHƯƠNG (không dùng toISOString
// vì hàm đó quy đổi sang UTC, gây lệch ngày ở múi giờ Việt Nam (UTC+7), ví dụ 00:00 giờ VN
// ngày 5/7 sẽ bị đổi thành "2026-07-04" nếu dùng toISOString — đây là nguyên nhân gây lệch
// ngày trong báo cáo/biểu đồ).
const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayISO = () => toISO(new Date());
const nowHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const monthKey = (iso) => iso.slice(0, 7); // YYYY-MM
const yearKey = (iso) => iso.slice(0, 4); // YYYY

// Cộng thêm n tháng vào 1 ngày, tự động chỉnh nếu tháng đích không đủ ngày (VD: 31/1 + 1 tháng -> 28 hoặc 29/2)
const addMonths = (date, n) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfTarget));
  return d;
};
const addPeriod = (date, freq) => {
  if (freq === "ngay") {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (freq === "thang") return addMonths(date, 1);
  if (freq === "nam") return addMonths(date, 12);
  return new Date(date);
};
const FREQ_LABEL = { ngay: "Hàng ngày", thang: "Hàng tháng", nam: "Hàng năm" };

// ---------- Chèn định dạng (màu, viền, đóng băng dòng tiêu đề) vào file Excel xuất ra ----------
// Thư viện "xlsx" miễn phí (SheetJS Community Edition) không hỗ trợ áp style khi ghi file,
// nên phải chỉnh trực tiếp vào cấu trúc XML bên trong file .xlsx (bản chất là 1 file zip),
// tương tự cách code này đã làm để chèn biểu đồ thật ở trên.
const excelColLetter = (idx) => {
  let n = idx + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

// Thêm font/màu nền/viền/định dạng số vào styles.xml, trả về chỉ số style để dùng cho từng ô
const buildStyledStylesXml = (xml) => {
  const bumpCount = (tag) => {
    const m = xml.match(new RegExp(`<${tag} count="(\\d+)">`));
    return m ? parseInt(m[1], 10) : 0;
  };

  const fontIdx = bumpCount("fonts");
  xml = xml.replace(/<fonts count="(\d+)">/, (_, c) => `<fonts count="${Number(c) + 1}">`);
  xml = xml.replace(
    "</fonts>",
    `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts>`
  );

  const fillIdx = bumpCount("fills");
  xml = xml.replace(/<fills count="(\d+)">/, (_, c) => `<fills count="${Number(c) + 1}">`);
  xml = xml.replace(
    "</fills>",
    `<fill><patternFill patternType="solid"><fgColor rgb="FF1E1B4B"/><bgColor indexed="64"/></patternFill></fill></fills>`
  );

  const borderIdx = bumpCount("borders");
  xml = xml.replace(/<borders count="(\d+)">/, (_, c) => `<borders count="${Number(c) + 1}">`);
  xml = xml.replace(
    "</borders>",
    `<border><left style="thin"><color rgb="FFDDD9C8"/></left><right style="thin"><color rgb="FFDDD9C8"/></right><top style="thin"><color rgb="FFDDD9C8"/></top><bottom style="thin"><color rgb="FFDDD9C8"/></bottom><diagonal/></border></borders>`
  );

  const CURRENCY_FMT_ID = 164;
  if (/<numFmts count="(\d+)">/.test(xml)) {
    xml = xml.replace(/<numFmts count="(\d+)">/, (_, c) => `<numFmts count="${Number(c) + 1}">`);
    xml = xml.replace("</numFmts>", `<numFmt numFmtId="${CURRENCY_FMT_ID}" formatCode="#,##0"/></numFmts>`);
  } else {
    xml = xml.replace(
      /(<styleSheet[^>]*>)/,
      `$1<numFmts count="1"><numFmt numFmtId="${CURRENCY_FMT_ID}" formatCode="#,##0"/></numFmts>`
    );
  }

  const baseXf = bumpCount("cellXfs");
  const HEADER_STYLE = baseXf;
  const BODY_STYLE = baseXf + 1;
  const CURRENCY_STYLE = baseXf + 2;
  xml = xml.replace(/<cellXfs count="(\d+)">/, (_, c) => `<cellXfs count="${Number(c) + 3}">`);
  xml = xml.replace(
    "</cellXfs>",
    `<xf numFmtId="0" fontId="${fontIdx}" fillId="${fillIdx}" borderId="${borderIdx}" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="${borderIdx}" xfId="0" applyBorder="1"/>` +
      `<xf numFmtId="${CURRENCY_FMT_ID}" fontId="0" fillId="0" borderId="${borderIdx}" xfId="0" applyNumberFormat="1" applyBorder="1"/>` +
      `</cellXfs>`
  );

  return { xml, HEADER_STYLE, BODY_STYLE, CURRENCY_STYLE };
};

// Gán style vào từng ô của 1 sheet: dòng 1 = tiêu đề (màu nền + chữ trắng đậm), các dòng
// còn lại = có viền, riêng cột tiền tệ được định dạng số có dấu phân cách hàng nghìn.
// Đồng thời đóng băng dòng tiêu đề (freeze pane) để cuộn dữ liệu vẫn thấy tiêu đề.
const applySheetTableStyle = (xml, numCols, numDataRows, currencyColIdx, styleIds) => {
  const { HEADER_STYLE, BODY_STYLE, CURRENCY_STYLE } = styleIds;

  xml = xml.replace(/<c r="([A-Za-z]+)1"/g, (_, col) => `<c r="${col}1" s="${HEADER_STYLE}"`);

  for (let ci = 0; ci < numCols; ci++) {
    const col = excelColLetter(ci);
    const styleId = currencyColIdx.includes(ci) ? CURRENCY_STYLE : BODY_STYLE;
    for (let r = 2; r <= numDataRows + 1; r++) {
      const target = `<c r="${col}${r}"`;
      xml = xml.replace(target, `${target} s="${styleId}"`);
    }
  }

  xml = xml.replace(
    /<sheetView workbookViewId="0"\/>/,
    `<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView>`
  );

  return xml;
};

// Tính các ngày đến hạn của 1 khoản định kỳ, từ lần tạo gần nhất tới hôm nay (bắt kịp nếu bỏ lỡ)
const getDueDates = (rule, todayIso) => {
  const start = new Date(rule.startDate + "T00:00:00");
  const today = new Date(todayIso + "T00:00:00");
  if (start > today) return [];
  let cursor = rule.lastGenerated
    ? addPeriod(new Date(rule.lastGenerated + "T00:00:00"), rule.frequency)
    : start;
  const dates = [];
  let guard = 0;
  while (cursor <= today && guard < 2000) {
    dates.push(toISO(cursor));
    cursor = addPeriod(cursor, rule.frequency);
    guard++;
  }
  return dates;
};

const PALETTE = [
  "#1E1B4B", "#10B981", "#F59E0B", "#0EA5E9", "#8B5CF6",
  "#F43F5E", "#06B6D4", "#F97316", "#6366F1", "#84CC16",
];
const colorFor = (name, list) => {
  const idx = list.indexOf(name);
  return PALETTE[idx % PALETTE.length];
};

// Đoán icon + màu + gradient ánh kim phù hợp theo tên danh mục (kể cả danh mục người dùng tự đặt), có phương án dự phòng
const CAT_ICON_RULES = [
  [["ăn", "uống", "cà phê", "cafe", "trà"], Utensils, "#E0654B", "linear-gradient(135deg, #FF9966, #C1293F)"],
  [["di chuyển", "xăng", "xe", "grab", "taxi", "gửi xe", "vé xe"], Car, "#3E6FB0", "linear-gradient(135deg, #6EC6FF, #1F3E7A)"],
  [["nhà", "thuê", "điện", "nước", "internet", "hóa đơn"], Home, "#B98A4E", "linear-gradient(135deg, #F4C97A, #92591E)"],
  [["giải trí", "phim", "game", "xem"], Film, "#7D5A8C", "linear-gradient(135deg, #C08CE0, #5B2E82)"],
  [["lương"], Banknote, "#1F7A5C", "linear-gradient(135deg, #4ADE94, #0B5C42)"],
  [["thưởng"], Banknote, "#C9963B", "linear-gradient(135deg, #FFDA9E, #B8790F)"],
  [["quà", "tặng"], Gift, "#C1447D", "linear-gradient(135deg, #FF9AC0, #A31859)"],
  [["y tế", "sức khỏe", "khám", "thuốc", "bệnh viện"], HeartPulse, "#3F9E6D", "linear-gradient(135deg, #6EE7B7, #0E6B4F)"],
  [["học", "giáo dục", "sách", "khóa học"], GraduationCap, "#3E4C8A", "linear-gradient(135deg, #8FA0E8, #26305E)"],
  [["mua sắm", "shopping", "đồ dùng"], ShoppingBag, "#9A5CB4", "linear-gradient(135deg, #D68FE0, #6B1E8C)"],
  [["du lịch", "vé máy bay", "khách sạn"], Plane, "#2E8C93", "linear-gradient(135deg, #5FE0D0, #145E68)"],
  [["quần áo", "thời trang"], Shirt, "#A85C3A", "linear-gradient(135deg, #E0916B, #7A3418)"],
  [["làm đẹp", "spa", "mỹ phẩm", "tóc"], Sparkles, "#D98BB0", "linear-gradient(135deg, #FFB3D1, #A3336B)"],
  [["thú cưng", "pet"], PawPrint, "#6B8F71", "linear-gradient(135deg, #8FD9A8, #275C3F)"],
  [["sửa chữa", "sửa", "bảo trì"], Wrench, "#6B7280", "linear-gradient(135deg, #A9B4C4, #3D4652)"],
  [["đầu tư", "cổ phiếu", "chứng khoán"], TrendingUpIcon, "#1B5E6B", "linear-gradient(135deg, #4FD1C5, #0D3E48)"],
  [["vay", "nợ", "trả góp", "cho mượn", "mượn"], HandCoins, "#8C5E3C", "linear-gradient(135deg, #D9A066, #5C3414)"],
  [["con", "em bé", "bỉm", "sữa"], Baby, "#4FA3C7", "linear-gradient(135deg, #8FD9F0, #1B5E82)"],
  [["điện thoại", "cước", "sim"], Smartphone, "#5C7A9E", "linear-gradient(135deg, #9FB8D9, #2E4A70)"],
];
const CAT_FALLBACK_COLORS = [
  "#16233F", "#3FAE8A", "#C9963B", "#5C7A9E", "#7D5A8C",
  "#C1443D", "#2E8C93", "#B98A4E", "#3E4C8A", "#7A9A7E",
];
const CAT_FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #FF9966, #C1293F)",
  "linear-gradient(135deg, #4ADE94, #0B5C42)",
  "linear-gradient(135deg, #FFDA9E, #B8790F)",
  "linear-gradient(135deg, #6EC6FF, #1F3E7A)",
  "linear-gradient(135deg, #C08CE0, #5B2E82)",
  "linear-gradient(135deg, #FF9AC0, #A31859)",
  "linear-gradient(135deg, #5FE0D0, #145E68)",
  "linear-gradient(135deg, #E0916B, #7A3418)",
  "linear-gradient(135deg, #8FA0E8, #26305E)",
  "linear-gradient(135deg, #8FD9A8, #275C3F)",
];
const KHAC_GRADIENT = "linear-gradient(135deg, #A9B4C4, #4B5563)";
const hashColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return CAT_FALLBACK_COLORS[Math.abs(hash) % CAT_FALLBACK_COLORS.length];
};
const hashGradient = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return CAT_FALLBACK_GRADIENTS[Math.abs(hash) % CAT_FALLBACK_GRADIENTS.length];
};
const getCatIcon = (name) => {
  const n = (name || "").toLowerCase();
  if (n.includes("khác")) return MoreHorizontal;
  for (const [keywords, Icon] of CAT_ICON_RULES) {
    if (keywords.some((k) => n.includes(k))) return Icon;
  }
  return Tag;
};
const getCatColor = (name) => {
  const n = (name || "").toLowerCase();
  if (n.includes("khác")) return "#7C8798";
  for (const [keywords, , color] of CAT_ICON_RULES) {
    if (keywords.some((k) => n.includes(k))) return color;
  }
  return hashColor(name || "");
};
// Gradient ánh kim dùng cho huy hiệu tròn phía sau icon danh mục
const getCatGradient = (name) => {
  const n = (name || "").toLowerCase();
  if (n.includes("khác")) return KHAC_GRADIENT;
  for (const [keywords, , , gradient] of CAT_ICON_RULES) {
    if (keywords.some((k) => n.includes(k))) return gradient;
  }
  return hashGradient(name || "");
};

const STORAGE_KEY_TX = "soquy:transactions";
const STORAGE_KEY_CATS = "soquy:categories";
const STORAGE_KEY_BUDGETS = "soquy:budgets";
const STORAGE_KEY_RECURRING = "soquy:recurring";

const DEFAULT_CATS = {
  thu: ["Lương", "Thưởng", "Khác"],
  chi: ["Ăn uống", "Di chuyển", "Nhà cửa", "Giải trí", "Khác"],
};

export default function SoQuy({ isAdmin = false, onOpenAdmin } = {}) {
  const [ready, setReady] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATS);
  const [budgets, setBudgets] = useState({}); // { "YYYY-MM:catName": amount }
  const [recurringRules, setRecurringRules] = useState([]);

  const [view, setView] = useState("nhap"); // nhap | so-cai | bao-cao | ngan-sach | dinh-ky | xuat

  // Export state
  const [exportPreset, setExportPreset] = useState("thang-nay");
  const [exportFrom, setExportFrom] = useState(() => monthKey(todayISO()) + "-01");
  const [exportTo, setExportTo] = useState(todayISO());
  const [toast, setToast] = useState(null);

  // Form state
  const [type, setType] = useState("chi");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingId, setEditingId] = useState(null);

  // Recurring form state
  const [rType, setRType] = useState("chi");
  const [rAmount, setRAmount] = useState("");
  const [rCat, setRCat] = useState("");
  const [rFreq, setRFreq] = useState("thang");
  const [rStartDate, setRStartDate] = useState(todayISO());
  const [rNote, setRNote] = useState("");
  const [editingRecurringId, setEditingRecurringId] = useState(null);
  const [showRecurringForm, setShowRecurringForm] = useState(false);

  // Report period
  const [reportMode, setReportMode] = useState("thang"); // ngay | thang | nam
  const [anchorDate, setAnchorDate] = useState(todayISO());

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // ---------- Load from storage ----------
  useEffect(() => {
    (async () => {
      try {
        const [txRes, catRes, budRes, recRes] = await Promise.allSettled([
          dataStore.get(STORAGE_KEY_TX),
          dataStore.get(STORAGE_KEY_CATS),
          dataStore.get(STORAGE_KEY_BUDGETS),
          dataStore.get(STORAGE_KEY_RECURRING),
        ]);
        let txList = txRes.status === "fulfilled" && txRes.value ? JSON.parse(txRes.value.value) : [];
        let catsObj = catRes.status === "fulfilled" && catRes.value ? JSON.parse(catRes.value.value) : DEFAULT_CATS;
        let budObj = budRes.status === "fulfilled" && budRes.value ? JSON.parse(budRes.value.value) : {};
        let recList = recRes.status === "fulfilled" && recRes.value ? JSON.parse(recRes.value.value) : [];

        // Tự động sinh các giao dịch định kỳ còn thiếu, tính đến hôm nay
        const today = todayISO();
        let generatedCount = 0;
        const newTxs = [];
        recList = recList.map((rule) => {
          if (!rule.active) return rule;
          const dueDates = getDueDates(rule, today);
          if (dueDates.length === 0) return rule;
          dueDates.forEach((d) => {
            newTxs.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              type: rule.type,
              amount: rule.amount,
              category: rule.category,
              date: d,
              note: rule.note ? `Định kỳ · ${rule.note}` : "Định kỳ",
              time: nowHM(),
              isRecurring: true,
              recurringId: rule.id,
            });
          });
          generatedCount += dueDates.length;
          return { ...rule, lastGenerated: dueDates[dueDates.length - 1] };
        });

        if (newTxs.length > 0) {
          txList = [...newTxs, ...txList];
          await dataStore.set(STORAGE_KEY_TX, JSON.stringify(txList));
          await dataStore.set(STORAGE_KEY_RECURRING, JSON.stringify(recList));
        }

        setTransactions(txList);
        setCategories(catsObj);
        setBudgets(budObj);
        setRecurringRules(recList);

        if (generatedCount > 0) {
          setTimeout(() => showToast(`Đã tự động ghi ${generatedCount} khoản định kỳ`), 400);
        }
      } catch (e) {
        console.error("Lỗi tải dữ liệu:", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // ---------- Persist helpers ----------
  const saveTx = useCallback(async (next) => {
    setTransactions(next);
    try {
      await dataStore.set(STORAGE_KEY_TX, JSON.stringify(next));
    } catch (e) {
      console.error("Lỗi lưu giao dịch:", e);
    }
  }, []);

  const saveCats = useCallback(async (next) => {
    setCategories(next);
    try {
      await dataStore.set(STORAGE_KEY_CATS, JSON.stringify(next));
    } catch (e) {
      console.error("Lỗi lưu danh mục:", e);
    }
  }, []);

  const saveBudgets = useCallback(async (next) => {
    setBudgets(next);
    try {
      await dataStore.set(STORAGE_KEY_BUDGETS, JSON.stringify(next));
    } catch (e) {
      console.error("Lỗi lưu ngân sách:", e);
    }
  }, []);

  const saveRecurring = useCallback(async (next) => {
    setRecurringRules(next);
    try {
      await dataStore.set(STORAGE_KEY_RECURRING, JSON.stringify(next));
    } catch (e) {
      console.error("Lỗi lưu khoản định kỳ:", e);
    }
  }, []);

  useEffect(() => {
    if (ready && !cat) {
      const list = categories[type];
      if (list && list.length) setCat(list[0]);
    }
  }, [ready, type, categories]); // eslint-disable-line

  useEffect(() => {
    if (ready && !rCat) {
      const list = categories[rType];
      if (list && list.length) setRCat(list[0]);
    }
  }, [ready, rType, categories]); // eslint-disable-line

  // ---------- Derived: running balance ----------
  const sorted = useMemo(
    () =>
      [...transactions].sort((a, b) =>
        (a.date + (a.time || "") + a.id).localeCompare(b.date + (b.time || "") + b.id)
      ),
    [transactions]
  );
  const totalBalance = useMemo(
    () =>
      transactions.reduce(
        (s, t) => s + (t.type === "thu" ? Number(t.amount) : -Number(t.amount)),
        0
      ),
    [transactions]
  );

  // ---------- Form submit ----------
  const resetForm = () => {
    setAmount("");
    setNote("");
    setEditingId(null);
    setDate(todayISO());
    setCat(categories[type][0] || "");
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      showToast("Nhập số tiền hợp lệ");
      return;
    }
    if (!cat) {
      showToast("Chọn danh mục");
      return;
    }
    if (editingId) {
      // Sửa nội dung nhưng giữ nguyên giờ ghi nhận gốc
      const next = transactions.map((t) =>
        t.id === editingId ? { ...t, type, amount: amt, category: cat, date, note } : t
      );
      await saveTx(next);
      showToast("Đã cập nhật giao dịch");
    } else {
      const rec = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        amount: amt,
        category: cat,
        date,
        note,
        time: nowHM(), // giờ:phút lúc nhập, tự động, không thể chỉnh tay
      };
      await saveTx([rec, ...transactions]);
      showToast(type === "thu" ? "Đã thêm khoản thu" : "Đã thêm khoản chi");
    }
    resetForm();
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setType(t.type);
    setAmount(String(t.amount));
    setCat(t.category);
    setDate(t.date);
    setNote(t.note || "");
    setView("nhap");
  };

  const deleteTx = async (id) => {
    await saveTx(transactions.filter((t) => t.id !== id));
    showToast("Đã xoá giao dịch");
  };

  const addCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    if (categories[type].includes(name)) {
      showToast("Danh mục đã tồn tại");
      return;
    }
    const next = { ...categories, [type]: [...categories[type], name] };
    await saveCats(next);
    setCat(name);
    setNewCatName("");
    setShowNewCat(false);
  };

  // ---------- Recurring rules ----------
  const resetRecurringForm = () => {
    setRAmount("");
    setRNote("");
    setEditingRecurringId(null);
    setRStartDate(todayISO());
    setRCat(categories[rType][0] || "");
    setShowRecurringForm(false);
  };

  const handleRecurringSubmit = async () => {
    const amt = parseFloat(rAmount);
    if (!amt || amt <= 0) {
      showToast("Nhập số tiền hợp lệ");
      return;
    }
    if (!rCat) {
      showToast("Chọn danh mục");
      return;
    }
    if (editingRecurringId) {
      const next = recurringRules.map((r) =>
        r.id === editingRecurringId
          ? { ...r, type: rType, amount: amt, category: rCat, frequency: rFreq, startDate: rStartDate, note: rNote }
          : r
      );
      await saveRecurring(next);
      showToast("Đã cập nhật khoản định kỳ");
    } else {
      const rule = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: rType,
        amount: amt,
        category: rCat,
        frequency: rFreq,
        startDate: rStartDate,
        note: rNote,
        active: true,
        lastGenerated: null,
      };
      // Sinh ngay các giao dịch đến hạn tính từ ngày bắt đầu tới hôm nay
      const dueDates = getDueDates(rule, todayISO());
      let finalRule = rule;
      if (dueDates.length > 0) {
        const newTxs = dueDates.map((d) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: rule.type,
          amount: rule.amount,
          category: rule.category,
          date: d,
          note: rule.note ? `Định kỳ · ${rule.note}` : "Định kỳ",
          time: nowHM(),
          isRecurring: true,
          recurringId: rule.id,
        }));
        await saveTx([...newTxs, ...transactions]);
        finalRule = { ...rule, lastGenerated: dueDates[dueDates.length - 1] };
      }
      await saveRecurring([finalRule, ...recurringRules]);
      showToast(dueDates.length > 0 ? `Đã tạo và ghi ${dueDates.length} giao dịch` : "Đã tạo khoản định kỳ");
    }
    resetRecurringForm();
  };

  const startEditRecurring = (r) => {
    setEditingRecurringId(r.id);
    setRType(r.type);
    setRAmount(String(r.amount));
    setRCat(r.category);
    setRFreq(r.frequency);
    setRStartDate(r.startDate);
    setRNote(r.note || "");
    setShowRecurringForm(true);
  };

  const deleteRecurring = async (id) => {
    await saveRecurring(recurringRules.filter((r) => r.id !== id));
    showToast("Đã xoá khoản định kỳ");
  };

  const toggleRecurringActive = async (id) => {
    const next = recurringRules.map((r) => {
      if (r.id !== id) return r;
      if (!r.active) {
        // Khi bật lại, bỏ qua khoảng thời gian đã tắt để tránh dồn quá nhiều giao dịch cũ
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return { ...r, active: true, lastGenerated: toISO(y) };
      }
      return { ...r, active: false };
    });
    await saveRecurring(next);
  };

  // ---------- Report data ----------
  const periodLabel = useMemo(() => {
    const d = new Date(anchorDate + "T00:00:00");
    if (reportMode === "ngay") return d.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    if (reportMode === "thang") return `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
    return `Năm ${d.getFullYear()}`;
  }, [anchorDate, reportMode]);

  const filteredForPeriod = useMemo(() => {
    if (reportMode === "ngay") return transactions.filter((t) => t.date === anchorDate);
    if (reportMode === "thang") return transactions.filter((t) => monthKey(t.date) === monthKey(anchorDate));
    return transactions.filter((t) => yearKey(t.date) === yearKey(anchorDate));
  }, [transactions, reportMode, anchorDate]);

  const periodThu = filteredForPeriod.filter((t) => t.type === "thu").reduce((s, t) => s + Number(t.amount), 0);
  const periodChi = filteredForPeriod.filter((t) => t.type === "chi").reduce((s, t) => s + Number(t.amount), 0);

  const pieData = useMemo(() => {
    const map = {};
    filteredForPeriod
      .filter((t) => t.type === "chi")
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount);
      });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredForPeriod]);

  const barData = useMemo(() => {
    // last 6 buckets depending on mode
    const buckets = [];
    const d = new Date(anchorDate + "T00:00:00");
    if (reportMode === "ngay") {
      for (let i = 6; i >= 0; i--) {
        const dd = new Date(d);
        dd.setDate(dd.getDate() - i);
        const iso = toISO(dd);
        const thu = transactions.filter((t) => t.date === iso && t.type === "thu").reduce((s, t) => s + Number(t.amount), 0);
        const chi = transactions.filter((t) => t.date === iso && t.type === "chi").reduce((s, t) => s + Number(t.amount), 0);
        buckets.push({ label: `${dd.getDate()}/${dd.getMonth() + 1}`, Thu: thu, Chi: chi });
      }
    } else if (reportMode === "thang") {
      for (let i = 5; i >= 0; i--) {
        const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
        const mk = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`;
        const thu = transactions.filter((t) => monthKey(t.date) === mk && t.type === "thu").reduce((s, t) => s + Number(t.amount), 0);
        const chi = transactions.filter((t) => monthKey(t.date) === mk && t.type === "chi").reduce((s, t) => s + Number(t.amount), 0);
        buckets.push({ label: `Thg${dd.getMonth() + 1}/${String(dd.getFullYear()).slice(2)}`, Thu: thu, Chi: chi });
      }
    } else {
      for (let i = 4; i >= 0; i--) {
        const yr = d.getFullYear() - i;
        const thu = transactions.filter((t) => yearKey(t.date) === String(yr) && t.type === "thu").reduce((s, t) => s + Number(t.amount), 0);
        const chi = transactions.filter((t) => yearKey(t.date) === String(yr) && t.type === "chi").reduce((s, t) => s + Number(t.amount), 0);
        buckets.push({ label: String(yr), Thu: thu, Chi: chi });
      }
    }
    return buckets;
  }, [transactions, reportMode, anchorDate]);

  const shiftPeriod = (dir) => {
    const d = new Date(anchorDate + "T00:00:00");
    if (reportMode === "ngay") d.setDate(d.getDate() + dir);
    else if (reportMode === "thang") d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setAnchorDate(toISO(d));
  };

  // ---------- Budgets ----------
  const currentMonthKey = monthKey(todayISO());
  const allCats = [...new Set([...categories.chi])];
  const monthChiByCat = useMemo(() => {
    const map = {};
    transactions
      .filter((t) => t.type === "chi" && monthKey(t.date) === currentMonthKey)
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount);
      });
    return map;
  }, [transactions, currentMonthKey]);

  const setBudgetFor = async (catName, val) => {
    const key = `${currentMonthKey}:${catName}`;
    const next = { ...budgets };
    if (!val || Number(val) <= 0) delete next[key];
    else next[key] = Number(val);
    await saveBudgets(next);
  };

  // ---------- Export Excel (kèm biểu đồ thống kê) ----------
  const exportExcel = async (fromDate, toDate, fileLabel) => {
    try {
      const XLSX = await import("xlsx");
      const JSZip = (await import("jszip")).default;
      const scoped = sorted.filter((t) => {
        if (fromDate && t.date < fromDate) return false;
        if (toDate && t.date > toDate) return false;
        return true;
      });

      if (scoped.length === 0) {
        showToast("Không có giao dịch nào trong khoảng đã chọn");
        return;
      }

      const rows = scoped.map((t) => ({
        "Ngày": t.date,
        "Giờ": t.time || "",
        "Loại": t.type === "thu" ? "Thu" : "Chi",
        "Danh mục": t.category,
        "Số tiền": Number(t.amount),
        "Ghi chú": t.note || "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Giao dịch");

      // sheet 2 — tổng hợp theo tháng, chỉ tính trong phạm vi đã chọn
      const summaryMap = {};
      scoped.forEach((t) => {
        const mk = monthKey(t.date);
        summaryMap[mk] = summaryMap[mk] || { thu: 0, chi: 0 };
        summaryMap[mk][t.type] += Number(t.amount);
      });
      const SHEET2_NAME = "Tổng hợp theo tháng";
      const summaryRows = Object.entries(summaryMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mk, v]) => ({
          "Tháng": mk,
          "Tổng thu": v.thu || 0,
          "Tổng chi": v.chi || 0,
          "Số dư": (v.thu || 0) - (v.chi || 0),
        }));
      const ws2 = XLSX.utils.json_to_sheet(summaryRows);
      ws2["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws2, SHEET2_NAME);

      // sheet 3 — tổng chi theo danh mục, chỉ tính trong phạm vi đã chọn (nguồn cho biểu đồ tròn)
      const SHEET3_NAME = "Chi theo danh mục";
      const catMap = {};
      scoped.filter((t) => t.type === "chi").forEach((t) => {
        catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount);
      });
      const categoryRows = Object.entries(catMap)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value]) => ({ "Danh mục": name, "Số tiền": value }));
      let ws3 = null;
      if (categoryRows.length > 0) {
        ws3 = XLSX.utils.json_to_sheet(categoryRows);
        ws3["!cols"] = [{ wch: 18 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws3, SHEET3_NAME);
      }

      // Tạo file .xlsx (dạng zip) từ workbook trước, sau đó mới áp style/biểu đồ vào bên trong
      const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const zip = await JSZip.loadAsync(buf);

      // ---- Áp định dạng: tô màu + chữ trắng đậm cho dòng tiêu đề, viền bảng, đóng băng
      // dòng tiêu đề, và định dạng số có dấu phân cách hàng nghìn cho cột tiền ----
      let stylesXml = await zip.file("xl/styles.xml").async("string");
      const { xml: newStylesXml, HEADER_STYLE, BODY_STYLE, CURRENCY_STYLE } = buildStyledStylesXml(stylesXml);
      zip.file("xl/styles.xml", newStylesXml);
      const styleIds = { HEADER_STYLE, BODY_STYLE, CURRENCY_STYLE };

      let sheet1xml = await zip.file("xl/worksheets/sheet1.xml").async("string");
      sheet1xml = applySheetTableStyle(sheet1xml, 6, rows.length, [4], styleIds);
      zip.file("xl/worksheets/sheet1.xml", sheet1xml);

      let sheet2xml = await zip.file("xl/worksheets/sheet2.xml").async("string");
      sheet2xml = applySheetTableStyle(sheet2xml, 4, summaryRows.length, [1, 2, 3], styleIds);
      zip.file("xl/worksheets/sheet2.xml", sheet2xml);

      if (ws3) {
        let sheet3xml = await zip.file("xl/worksheets/sheet3.xml").async("string");
        sheet3xml = applySheetTableStyle(sheet3xml, 2, categoryRows.length, [1], styleIds);
        zip.file("xl/worksheets/sheet3.xml", sheet3xml);
      }

      // ---- Chèn biểu đồ thật (OOXML) vào file, vì thư viện xlsx miễn phí không hỗ trợ
      // tạo biểu đồ trực tiếp — cần thao tác thủ công vào cấu trúc file .xlsx (vốn là 1 file zip) ----
      const barChartXml = (lastRow) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>Thu - Chi theo tháng</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>
        <c:ser>
          <c:idx val="0"/><c:order val="0"/>
          <c:tx><c:strRef><c:f>'${SHEET2_NAME}'!$B$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Tổng thu</c:v></c:pt></c:strCache></c:strRef></c:tx>
          <c:spPr><a:solidFill><a:srgbClr val="10B981"/></a:solidFill></c:spPr>
          <c:cat><c:strRef><c:f>'${SHEET2_NAME}'!$A$2:$A$${lastRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>'${SHEET2_NAME}'!$B$2:$B$${lastRow}</c:f></c:numRef></c:val>
        </c:ser>
        <c:ser>
          <c:idx val="1"/><c:order val="1"/>
          <c:tx><c:strRef><c:f>'${SHEET2_NAME}'!$C$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Tổng chi</c:v></c:pt></c:strCache></c:strRef></c:tx>
          <c:spPr><a:solidFill><a:srgbClr val="F43F5E"/></a:solidFill></c:spPr>
          <c:cat><c:strRef><c:f>'${SHEET2_NAME}'!$A$2:$A$${lastRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>'${SHEET2_NAME}'!$C$2:$C$${lastRow}</c:f></c:numRef></c:val>
        </c:ser>
        <c:axId val="111111111"/><c:axId val="222222222"/>
      </c:barChart>
      <c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/></c:catAx>
      <c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111111111"/></c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;

      const pieChartXml = (lastRow) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>Chi theo danh m${"\u1ee5"}c</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:pieChart>
        <c:varyColors val="1"/>
        <c:ser>
          <c:idx val="0"/><c:order val="0"/>
          <c:tx><c:strRef><c:f>'${SHEET3_NAME}'!$B$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>Số tiền</c:v></c:pt></c:strCache></c:strRef></c:tx>
          <c:cat><c:strRef><c:f>'${SHEET3_NAME}'!$A$2:$A$${lastRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>'${SHEET3_NAME}'!$B$2:$B$${lastRow}</c:f></c:numRef></c:val>
        </c:ser>
      </c:pieChart>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;

      const mkDrawing = (rId, colFrom, colTo) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>${colFrom}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>${colTo}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>20</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rId}"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;

      const mkDrawingRels = (target) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="${target}"/>
</Relationships>`;

      const mkSheetRels = (drawingTarget) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="${drawingTarget}"/>
</Relationships>`;

      let contentTypeOverrides = "";

      // Biểu đồ cột: Thu - Chi theo tháng, gắn vào sheet2.xml
      zip.file("xl/charts/chart1.xml", barChartXml(1 + summaryRows.length));
      zip.file("xl/drawings/drawing1.xml", mkDrawing("rId1", 6, 14));
      zip.file("xl/drawings/_rels/drawing1.xml.rels", mkDrawingRels("../charts/chart1.xml"));
      zip.file("xl/worksheets/_rels/sheet2.xml.rels", mkSheetRels("../drawings/drawing1.xml"));
      let sheet2 = await zip.file("xl/worksheets/sheet2.xml").async("string");
      sheet2 = sheet2.replace("</worksheet>", `<drawing r:id="rId1"/></worksheet>`);
      zip.file("xl/worksheets/sheet2.xml", sheet2);
      contentTypeOverrides +=
        `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` +
        `<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;

      // Biểu đồ tròn: Chi theo danh mục, gắn vào sheet3.xml (nếu có dữ liệu chi)
      if (ws3) {
        zip.file("xl/charts/chart2.xml", pieChartXml(1 + categoryRows.length));
        zip.file("xl/drawings/drawing2.xml", mkDrawing("rId1", 4, 10));
        zip.file("xl/drawings/_rels/drawing2.xml.rels", mkDrawingRels("../charts/chart2.xml"));
        zip.file("xl/worksheets/_rels/sheet3.xml.rels", mkSheetRels("../drawings/drawing2.xml"));
        let sheet3 = await zip.file("xl/worksheets/sheet3.xml").async("string");
        sheet3 = sheet3.replace("</worksheet>", `<drawing r:id="rId1"/></worksheet>`);
        zip.file("xl/worksheets/sheet3.xml", sheet3);
        contentTypeOverrides +=
          `<Override PartName="/xl/drawings/drawing2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` +
          `<Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;
      }

      let ct = await zip.file("[Content_Types].xml").async("string");
      ct = ct.replace("</Types>", `${contentTypeOverrides}</Types>`);
      zip.file("[Content_Types].xml", ct);

      const finalBuf = await zip.generateAsync({ type: "uint8array" });
      const blob = new Blob([finalBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `so-quy-${fileLabel}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Đã xuất ${scoped.length} giao dịch ra Excel (kèm biểu đồ)`);
    } catch (e) {
      console.error(e);
      showToast("Không thể xuất file, thử lại sau");
    }
  };

  const exportPreview = useMemo(() => {
    const list = sorted.filter((t) => {
      if (exportFrom && t.date < exportFrom) return false;
      if (exportTo && t.date > exportTo) return false;
      return true;
    });
    const thu = list.filter((t) => t.type === "thu").reduce((s, t) => s + Number(t.amount), 0);
    const chi = list.filter((t) => t.type === "chi").reduce((s, t) => s + Number(t.amount), 0);
    return { count: list.length, thu, chi };
  }, [sorted, exportFrom, exportTo]);

  const applyExportPreset = (preset) => {
    const today = todayISO();
    if (preset === "thang-nay") {
      setExportFrom(monthKey(today) + "-01");
      setExportTo(today);
    } else if (preset === "thang-truoc") {
      const d = addMonths(new Date(today + "T00:00:00"), -1);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      setExportFrom(`${mk}-01`);
      setExportTo(`${mk}-${String(lastDay).padStart(2, "0")}`);
    } else if (preset === "nam-nay") {
      setExportFrom(`${yearKey(today)}-01-01`);
      setExportTo(today);
    } else if (preset === "nam-truoc") {
      const y = Number(yearKey(today)) - 1;
      setExportFrom(`${y}-01-01`);
      setExportTo(`${y}-12-31`);
    } else if (preset === "toan-bo") {
      setExportFrom("");
      setExportTo("");
    }
    setExportPreset(preset);
  };

  const handleExportSubmit = () => {
    if (exportPreset === "tuy-chinh" && exportFrom && exportTo && exportFrom > exportTo) {
      showToast("Ngày bắt đầu phải trước ngày kết thúc");
      return;
    }
    let label;
    if (exportPreset === "toan-bo") label = "toan-bo";
    else if (exportPreset === "thang-nay" || exportPreset === "thang-truoc") label = `thang-${(exportFrom || "").slice(0, 7)}`;
    else if (exportPreset === "nam-nay" || exportPreset === "nam-truoc") label = `nam-${(exportFrom || "").slice(0, 4)}`;
    else label = `${exportFrom || "batdau"}_den_${exportTo || "hientai"}`;
    exportExcel(exportFrom, exportTo, label);
  };


  if (!ready) {
    return (
      <div style={{ background: BG, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: INK_SOFT, fontFamily: SERIF, fontSize: 18 }}>Đang mở sổ quỹ…</div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <style>{fontImport}</style>

      {/* Header */}
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>SỔ QUỸ CÁ NHÂN</div>
          <div style={styles.balanceLabel}>Số dư hiện tại</div>
          <div style={{ ...styles.balanceValue, color: totalBalance >= 0 ? MINT : DANGER_ON_DARK }}>
            {totalBalance < 0 ? "-" : ""}{fmt(Math.abs(totalBalance))} <span style={styles.dong}>đ</span>
          </div>
        </div>
        <button style={styles.exportBtn} onClick={() => setView("xuat")} aria-label="Xuất Excel">
          <Download size={16} strokeWidth={2.2} />
          <span>Xuất Excel</span>
        </button>
      </header>

      {/* Content */}
      <main style={styles.main}>
        {view === "nhap" && (
          <EntryView
            type={type} setType={setType}
            amount={amount} setAmount={setAmount}
            cat={cat} setCat={setCat}
            date={date} setDate={setDate}
            note={note} setNote={setNote}
            categories={categories}
            showNewCat={showNewCat} setShowNewCat={setShowNewCat}
            newCatName={newCatName} setNewCatName={setNewCatName}
            addCategory={addCategory}
            handleSubmit={handleSubmit}
            editingId={editingId}
            resetForm={resetForm}
            recent={sorted.slice(0, 5).reverse()}
            onEdit={startEdit}
            onDelete={deleteTx}
          />
        )}

        {view === "so-cai" && (
          <LedgerView transactions={sorted} onEdit={startEdit} onDelete={deleteTx} />
        )}

        {view === "bao-cao" && (
          <ReportView
            reportMode={reportMode} setReportMode={setReportMode}
            periodLabel={periodLabel} shiftPeriod={shiftPeriod}
            periodThu={periodThu} periodChi={periodChi}
            pieData={pieData} barData={barData}
            categories={categories}
          />
        )}

        {view === "ngan-sach" && (
          <BudgetView
            allCats={allCats}
            budgets={budgets}
            currentMonthKey={currentMonthKey}
            monthChiByCat={monthChiByCat}
            setBudgetFor={setBudgetFor}
          />
        )}

        {view === "dinh-ky" && (
          <RecurringView
            rules={recurringRules}
            categories={categories}
            rType={rType} setRType={setRType}
            rAmount={rAmount} setRAmount={setRAmount}
            rCat={rCat} setRCat={setRCat}
            rFreq={rFreq} setRFreq={setRFreq}
            rStartDate={rStartDate} setRStartDate={setRStartDate}
            rNote={rNote} setRNote={setRNote}
            showRecurringForm={showRecurringForm} setShowRecurringForm={setShowRecurringForm}
            editingRecurringId={editingRecurringId}
            handleRecurringSubmit={handleRecurringSubmit}
            resetRecurringForm={resetRecurringForm}
            startEditRecurring={startEditRecurring}
            deleteRecurring={deleteRecurring}
            toggleRecurringActive={toggleRecurringActive}
          />
        )}

        {view === "xuat" && (
          <ExportView
            exportPreset={exportPreset}
            applyExportPreset={applyExportPreset}
            exportFrom={exportFrom} setExportFrom={setExportFrom}
            exportTo={exportTo} setExportTo={setExportTo}
            exportPreview={exportPreview}
            handleExportSubmit={handleExportSubmit}
            setExportPreset={setExportPreset}
          />
        )}

        {view === "xuat" && (
          <div style={{ marginTop: 16 }}>
            <button
              style={{ ...styles.exportPresetChip, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              onClick={() => supabase.auth.signOut()}
            >
              <Power size={16} /> Đăng xuất
            </button>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav style={styles.nav}>
        <NavBtn icon={<Plus size={20} />} label="Nhập" active={view === "nhap"} onClick={() => setView("nhap")} />
        <NavBtn icon={<Wallet size={20} />} label="Sổ cái" active={view === "so-cai"} onClick={() => setView("so-cai")} />
        <NavBtn icon={<TrendingUp size={20} />} label="Báo cáo" active={view === "bao-cao"} onClick={() => setView("bao-cao")} />
        <NavBtn icon={<PiggyBank size={20} />} label="Ngân sách" active={view === "ngan-sach"} onClick={() => setView("ngan-sach")} />
        <NavBtn icon={<Repeat size={20} />} label="Định kỳ" active={view === "dinh-ky"} onClick={() => setView("dinh-ky")} />
        <NavBtn icon={<Download size={20} />} label="Xuất" active={view === "xuat"} onClick={() => setView("xuat")} />
        {isAdmin && (
          <NavBtn icon={<Shield size={20} />} label="Quản trị" active={false} onClick={onOpenAdmin} />
        )}
      </nav>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

// ================= Sub-views =================

function EntryView({
  type, setType, amount, setAmount, cat, setCat, date, setDate, note, setNote,
  categories, showNewCat, setShowNewCat, newCatName, setNewCatName, addCategory,
  handleSubmit, editingId, resetForm, recent, onEdit, onDelete,
}) {
  const list = categories[type] || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={styles.card}>
        {editingId && (
          <div style={styles.editingBanner}>
            <PenLine size={14} />
            <span>Đang sửa giao dịch</span>
            <button style={styles.cancelEditBtn} onClick={resetForm}><X size={14} /></button>
          </div>
        )}

        {/* Type toggle */}
        <div style={styles.typeToggle}>
          <button
            style={{ ...styles.typeBtn, ...(type === "chi" ? styles.typeBtnActiveChi : {}) }}
            onClick={() => { setType("chi"); setCat(""); }}
          >
            <TrendingDown size={16} /> Chi
          </button>
          <button
            style={{ ...styles.typeBtn, ...(type === "thu" ? styles.typeBtnActiveThu : {}) }}
            onClick={() => { setType("thu"); setCat(""); }}
          >
            <TrendingUp size={16} /> Thu
          </button>
        </div>

        {/* Amount */}
        <label style={styles.fieldLabel}>Số tiền</label>
        <div style={styles.amountRow}>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={styles.amountInput}
          />
          <span style={styles.dongSuffix}>đ</span>
        </div>

        {/* Category */}
        <label style={styles.fieldLabel}>Danh mục</label>
        <div style={styles.catGrid}>
          {list.map((c) => {
            const active = cat === c;
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                style={{
                  ...styles.catChip,
                  ...(active ? { background: GRADIENT_NAVY_CHIP, color: PAPER, borderColor: INK } : {}),
                }}
              >
                <CatBadge name={c} size={20} iconSize={11} />
                {c}
              </button>
            );
          })}
          <button style={styles.catChipAdd} onClick={() => setShowNewCat((s) => !s)}>
            <Plus size={13} /> Danh mục mới
          </button>
        </div>

        {showNewCat && (
          <div style={styles.newCatRow}>
            <input
              style={styles.newCatInput}
              placeholder="Tên danh mục..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
            <button style={styles.newCatSave} onClick={addCategory}>Thêm</button>
          </div>
        )}

        {/* Date */}
        <label style={styles.fieldLabel}>Ngày</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={styles.dateInput}
        />

        {/* Note */}
        <label style={styles.fieldLabel}>Ghi chú (tuỳ chọn)</label>
        <input
          type="text"
          placeholder="VD: Ăn trưa với đồng nghiệp"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={styles.noteInput}
        />

        <button
          style={{ ...styles.submitBtn, background: type === "chi" ? GRADIENT_DANGER : GRADIENT_SUCCESS }}
          onClick={handleSubmit}
        >
          {editingId ? "Cập nhật" : type === "chi" ? "Ghi khoản chi" : "Ghi khoản thu"}
        </button>
      </div>

      {recent.length > 0 && (
        <div>
          <div style={styles.sectionTitle}>Vừa nhập gần đây</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recent.map((t) => (
              <TxRow key={t.id} t={t} onEdit={onEdit} onDelete={onDelete} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Huy hiệu tròn gradient ánh kim đặt phía sau icon danh mục — dùng chung ở mọi nơi hiển thị danh mục
function CatBadge({ name, size = 26, iconSize = 14 }) {
  const Icon = getCatIcon(name);
  const gradient = getCatGradient(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: gradient,
        flexShrink: 0,
        boxShadow: `0 2px 5px rgba(20,20,30,0.18)`,
      }}
    >
      <Icon size={iconSize} strokeWidth={2.2} color="#FFFFFF" />
    </div>
  );
}

function TxRow({ t, onEdit, onDelete, compact }) {
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div style={styles.txRow}>
      <CatBadge name={t.category} size={30} iconSize={15} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.txCat}>
          {t.category}
          {t.isRecurring && <Repeat size={11} style={{ marginLeft: 5, verticalAlign: -1 }} color={INK_FADE} />}
        </div>
        <div style={styles.txMeta}>
          {new Date(t.date + "T00:00:00").toLocaleDateString("vi-VN")}
          {t.time ? ` · ${t.time}` : ""}
          {t.note ? ` · ${t.note}` : ""}
        </div>
      </div>
      <div style={{ ...styles.txAmount, color: t.type === "thu" ? SUCCESS : DANGER }}>
        {t.type === "thu" ? "+" : "-"}{fmt(t.amount)}
      </div>
      {!compact && (
        <div style={{ display: "flex", gap: 4 }}>
          <button style={styles.iconBtn} onClick={() => onEdit(t)}><PenLine size={14} /></button>
          {confirmDel ? (
            <button style={{ ...styles.iconBtn, color: DANGER }} onClick={() => onDelete(t.id)}>
              <X size={14} />
            </button>
          ) : (
            <button style={styles.iconBtn} onClick={() => setConfirmDel(true)}><Trash2 size={14} /></button>
          )}
        </div>
      )}
    </div>
  );
}

function LedgerView({ transactions, onEdit, onDelete }) {
  const [filter, setFilter] = useState("all"); // all | thu | chi
  const list = transactions
    .filter((t) => filter === "all" || t.type === filter)
    .slice()
    .reverse();

  // group by date
  const groups = {};
  list.forEach((t) => {
    groups[t.date] = groups[t.date] || [];
    groups[t.date].push(t);
  });
  const dateKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  if (transactions.length === 0) {
    return <EmptyState text="Chưa có giao dịch nào. Sang mục Nhập để ghi khoản đầu tiên." />;
  }

  return (
    <div>
      <div style={styles.filterRow}>
        {["all", "thu", "chi"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...styles.filterChip, ...(filter === f ? styles.filterChipActive : {}) }}
          >
            {f === "all" ? "Tất cả" : f === "thu" ? "Thu" : "Chi"}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {dateKeys.map((dk) => (
          <div key={dk}>
            <div style={styles.dateGroupLabel}>
              {new Date(dk + "T00:00:00").toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groups[dk].map((t) => (
                <TxRow key={t.id} t={t} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportView({ reportMode, setReportMode, periodLabel, shiftPeriod, periodThu, periodChi, pieData, barData, categories }) {
  const balance = periodThu - periodChi;
  const catList = pieData.map((d) => d.name);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={styles.modeToggle}>
        {[["ngay", "Ngày"], ["thang", "Tháng"], ["nam", "Năm"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setReportMode(k)}
            style={{ ...styles.modeBtn, ...(reportMode === k ? styles.modeBtnActive : {}) }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={styles.periodRow}>
        <button style={styles.periodArrow} onClick={() => shiftPeriod(-1)}><ChevronLeft size={18} /></button>
        <div style={styles.periodLabel}>{periodLabel}</div>
        <button style={styles.periodArrow} onClick={() => shiftPeriod(1)}><ChevronRight size={18} /></button>
      </div>

      <div style={styles.statGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Tổng thu</div>
          <div style={{ ...styles.statValue, color: SUCCESS }}>{fmt(periodThu)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Tổng chi</div>
          <div style={{ ...styles.statValue, color: DANGER }}>{fmt(periodChi)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Chênh lệch</div>
          <div style={{ ...styles.statValue, color: balance >= 0 ? INK : DANGER }}>
            {balance < 0 ? "-" : ""}{fmt(Math.abs(balance))}
          </div>
        </div>
      </div>

      {pieData.length > 0 ? (
        <div style={styles.card}>
          <div style={styles.sectionTitle}>Cơ cấu chi tiêu theo danh mục</div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={colorFor(entry.name, catList)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${fmt(v)} đ`} contentStyle={{ fontFamily: SANS, fontSize: 13, borderRadius: 10, border: `1px solid ${LINE}` }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={styles.legendWrap}>
            {[...pieData].sort((a, b) => b.value - a.value).map((d) => (
              <div key={d.name} style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: colorFor(d.name, catList) }} />
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ fontWeight: 600 }}>{fmt(d.value)} đ</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState text="Chưa có khoản chi nào trong kỳ này." />
      )}

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Xu hướng thu — chi</div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={LINE} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fontFamily: SANS, fill: INK_SOFT }} axisLine={{ stroke: LINE }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fontFamily: SANS, fill: INK_SOFT }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${v/1000000}tr` : v} />
              <Tooltip formatter={(v) => `${fmt(v)} đ`} contentStyle={{ fontFamily: SANS, fontSize: 13, borderRadius: 10, border: `1px solid ${LINE}` }} />
              <Legend wrapperStyle={{ fontFamily: SANS, fontSize: 12 }} />
              <Bar dataKey="Thu" fill={SUCCESS} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Chi" fill={DANGER} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function BudgetView({ allCats, budgets, currentMonthKey, monthChiByCat, setBudgetFor }) {
  return (
    <div>
      <div style={styles.sectionTitle}>Ngân sách tháng {currentMonthKey.slice(5)}/{currentMonthKey.slice(0, 4)}</div>
      {allCats.length === 0 ? (
        <EmptyState text="Chưa có danh mục chi nào. Thêm danh mục ở mục Nhập trước." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {allCats.map((c) => {
            const key = `${currentMonthKey}:${c}`;
            const budget = budgets[key] || 0;
            const spent = monthChiByCat[c] || 0;
            const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
            const over = budget > 0 && spent > budget;
            return (
              <div key={c} style={styles.card}>
                <div style={styles.budgetHeader}>
                  <div style={{ ...styles.budgetCatName, display: "flex", alignItems: "center", gap: 8 }}>
                    <CatBadge name={c} size={24} iconSize={13} />
                    {c}
                  </div>
                  {over && (
                    <div style={styles.overBadge}>
                      <AlertTriangle size={12} /> Vượt hạn mức
                    </div>
                  )}
                </div>
                <div style={styles.budgetInputRow}>
                  <span style={styles.budgetInputLabel}>Hạn mức</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Chưa đặt"
                    defaultValue={budget || ""}
                    onBlur={(e) => setBudgetFor(c, e.target.value)}
                    style={styles.budgetInput}
                  />
                  <span>đ</span>
                </div>
                {budget > 0 && (
                  <>
                    <div style={styles.progressTrack}>
                      <div style={{ ...styles.progressFill, width: `${pct}%`, background: over ? GRADIENT_DANGER : GRADIENT_NAVY_CHIP }} />
                    </div>
                    <div style={styles.budgetSpentRow}>
                      <span>Đã chi <b>{fmt(spent)}</b> đ</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                  </>
                )}
                {budget === 0 && spent > 0 && (
                  <div style={styles.budgetSpentRow}>
                    <span>Đã chi <b>{fmt(spent)}</b> đ (chưa đặt hạn mức)</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecurringView({
  rules, categories,
  rType, setRType, rAmount, setRAmount, rCat, setRCat, rFreq, setRFreq,
  rStartDate, setRStartDate, rNote, setRNote,
  showRecurringForm, setShowRecurringForm, editingRecurringId,
  handleRecurringSubmit, resetRecurringForm, startEditRecurring, deleteRecurring, toggleRecurringActive,
}) {
  const list = categories[rType] || [];

  const nextDueLabel = (r) => {
    const next = r.lastGenerated
      ? addPeriod(new Date(r.lastGenerated + "T00:00:00"), r.frequency)
      : new Date(r.startDate + "T00:00:00");
    return next.toLocaleDateString("vi-VN");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={styles.recurringIntro}>
        Khoản cố định sẽ tự động ghi vào sổ đúng ngày, không cần bạn nhập tay mỗi lần.
      </div>

      {!showRecurringForm && (
        <button style={styles.addRecurringBtn} onClick={() => { resetRecurringForm(); setShowRecurringForm(true); }}>
          <Plus size={16} /> Thêm khoản định kỳ
        </button>
      )}

      {showRecurringForm && (
        <div style={styles.card}>
          {editingRecurringId && (
            <div style={styles.editingBanner}>
              <PenLine size={14} />
              <span>Đang sửa khoản định kỳ</span>
              <button style={styles.cancelEditBtn} onClick={resetRecurringForm}><X size={14} /></button>
            </div>
          )}

          <div style={styles.typeToggle}>
            <button
              style={{ ...styles.typeBtn, ...(rType === "chi" ? styles.typeBtnActiveChi : {}) }}
              onClick={() => { setRType("chi"); setRCat(""); }}
            >
              <TrendingDown size={16} /> Chi
            </button>
            <button
              style={{ ...styles.typeBtn, ...(rType === "thu" ? styles.typeBtnActiveThu : {}) }}
              onClick={() => { setRType("thu"); setRCat(""); }}
            >
              <TrendingUp size={16} /> Thu
            </button>
          </div>

          <label style={styles.fieldLabel}>Số tiền mỗi lần</label>
          <div style={styles.amountRow}>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={rAmount}
              onChange={(e) => setRAmount(e.target.value)}
              style={styles.amountInput}
            />
            <span style={styles.dongSuffix}>đ</span>
          </div>

          <label style={styles.fieldLabel}>Danh mục</label>
          <div style={styles.catGrid}>
            {list.map((c) => {
              const active = rCat === c;
              return (
                <button
                  key={c}
                  onClick={() => setRCat(c)}
                  style={{
                    ...styles.catChip,
                    ...(active ? { background: GRADIENT_NAVY_CHIP, color: PAPER, borderColor: INK } : {}),
                  }}
                >
                  <CatBadge name={c} size={20} iconSize={11} />
                  {c}
                </button>
              );
            })}
          </div>

          <label style={styles.fieldLabel}>Tần suất lặp lại</label>
          <div style={styles.modeToggle}>
            {[["ngay", "Hàng ngày"], ["thang", "Hàng tháng"], ["nam", "Hàng năm"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setRFreq(k)}
                style={{ ...styles.modeBtn, ...(rFreq === k ? styles.modeBtnActive : {}) }}
              >
                {label}
              </button>
            ))}
          </div>

          <label style={styles.fieldLabel}>Bắt đầu từ ngày</label>
          <input
            type="date"
            value={rStartDate}
            onChange={(e) => setRStartDate(e.target.value)}
            style={styles.dateInput}
          />

          <label style={styles.fieldLabel}>Ghi chú (tuỳ chọn)</label>
          <input
            type="text"
            placeholder="VD: Tiền thuê nhà"
            value={rNote}
            onChange={(e) => setRNote(e.target.value)}
            style={styles.noteInput}
          />

          <button
            style={{ ...styles.submitBtn, background: rType === "chi" ? GRADIENT_DANGER : GRADIENT_SUCCESS }}
            onClick={handleRecurringSubmit}
          >
            {editingRecurringId ? "Cập nhật khoản định kỳ" : "Lưu khoản định kỳ"}
          </button>
        </div>
      )}

      {rules.length === 0 ? (
        <EmptyState text="Chưa có khoản định kỳ nào. Thêm khoản tiền nhà, lương, trả góp... để hệ thống tự ghi hộ bạn." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rules.map((r) => {
            return (
            <div key={r.id} style={{ ...styles.card, opacity: r.active ? 1 : 0.55 }}>
              <div style={styles.recurringRowTop}>
                <div>
                  <div style={{ ...styles.recurringCatName, display: "flex", alignItems: "center", gap: 8 }}>
                    <CatBadge name={r.category} size={24} iconSize={13} />
                    {r.category}
                  </div>
                  <div style={styles.recurringMeta}>{FREQ_LABEL[r.frequency]} · Kế tiếp {nextDueLabel(r)}</div>
                  {r.note && <div style={styles.recurringMeta}>{r.note}</div>}
                </div>
                <div style={{ ...styles.recurringAmount, color: r.type === "thu" ? SUCCESS : DANGER }}>
                  {r.type === "thu" ? "+" : "-"}{fmt(r.amount)}
                </div>
              </div>
              <div style={styles.recurringActions}>
                <button style={styles.recurringActionBtn} onClick={() => toggleRecurringActive(r.id)}>
                  <Power size={13} /> {r.active ? "Tạm dừng" : "Bật lại"}
                </button>
                <button style={styles.recurringActionBtn} onClick={() => startEditRecurring(r)}>
                  <PenLine size={13} /> Sửa
                </button>
                <button style={{ ...styles.recurringActionBtn, color: DANGER }} onClick={() => deleteRecurring(r.id)}>
                  <Trash2 size={13} /> Xoá
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExportView({
  exportPreset, applyExportPreset, exportFrom, setExportFrom, exportTo, setExportTo,
  exportPreview, handleExportSubmit, setExportPreset,
}) {
  const presets = [
    ["thang-nay", "Tháng này"],
    ["thang-truoc", "Tháng trước"],
    ["nam-nay", "Năm nay"],
    ["nam-truoc", "Năm trước"],
    ["toan-bo", "Toàn bộ"],
    ["tuy-chinh", "Tuỳ chỉnh"],
  ];

  const rangeLabel = () => {
    if (exportPreset === "toan-bo") return "Toàn bộ lịch sử giao dịch";
    if (!exportFrom && !exportTo) return "Chọn khoảng thời gian";
    const f = exportFrom ? new Date(exportFrom + "T00:00:00").toLocaleDateString("vi-VN") : "…";
    const t = exportTo ? new Date(exportTo + "T00:00:00").toLocaleDateString("vi-VN") : "…";
    return `Từ ${f} đến ${t}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={styles.recurringIntro}>
        Chọn khoảng thời gian bạn muốn xuất — theo tháng, theo năm, toàn bộ, hoặc tự chọn ngày bắt đầu/kết thúc.
      </div>

      <div style={styles.exportPresetGrid}>
        {presets.map(([k, label]) => (
          <button
            key={k}
            onClick={() => applyExportPreset(k)}
            style={{
              ...styles.exportPresetChip,
              ...(exportPreset === k ? { background: GRADIENT_NAVY_CHIP, color: "#FFFFFF", borderColor: "transparent" } : {}),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {exportPreset === "tuy-chinh" && (
        <div style={styles.card}>
          <label style={styles.fieldLabel}>Từ ngày</label>
          <input
            type="date"
            value={exportFrom}
            onChange={(e) => setExportFrom(e.target.value)}
            style={styles.dateInput}
          />
          <label style={styles.fieldLabel}>Đến ngày</label>
          <input
            type="date"
            value={exportTo}
            onChange={(e) => setExportTo(e.target.value)}
            style={styles.dateInput}
          />
        </div>
      )}

      <div style={styles.card}>
        <div style={styles.sectionTitle}>Xem trước</div>
        <div style={styles.exportRangeLabel}>{rangeLabel()}</div>
        <div style={styles.statGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Giao dịch</div>
            <div style={{ ...styles.statValue, color: INK }}>{exportPreview.count}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Tổng thu</div>
            <div style={{ ...styles.statValue, color: SUCCESS }}>{fmt(exportPreview.thu)}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Tổng chi</div>
            <div style={{ ...styles.statValue, color: DANGER }}>{fmt(exportPreview.chi)}</div>
          </div>
        </div>
      </div>

      <button style={styles.exportSubmitBtn} onClick={handleExportSubmit}>
        <Download size={16} /> Xuất file Excel
      </button>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ ...styles.navBtn, color: active ? INK : INK_FADE }}>
      {icon}
      <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div style={styles.emptyState}>
      <Calendar size={28} color={INK_FADE} strokeWidth={1.5} />
      <div style={styles.emptyText}>{text}</div>
    </div>
  );
}

// ================= Design tokens: "Ngân hàng tin cậy" =================
// ================= Design tokens: "Cực quang số" — năng động, hiện đại =================
const NAVY = "#1E1B4B";        // tím than đậm — vẫn dùng làm màu chữ chính/thương hiệu
const NAVY_SOFT = "#4338CA";   // chàm sáng hơn — điểm chuyển giữa gradient
const MINT = "#34D399";        // ngọc lục bảo sáng — điểm nhấn khoản thu trên nền tối
const MINT_DEEP = "#0D9467";   // ngọc lục bảo đậm — dùng cho chữ số cần độ tương phản trên nền sáng
const GOLD = "#0EA5E9";        // xanh dương điện — thay thế vàng đồng, dùng làm điểm nhấn hiện đại
const PAPER = "#F6F7FC";       // nền chính toàn app — trắng ánh tím rất nhẹ
const PAPER_RAISED = "#F8F6FF";// nền thẻ/card — trắng ánh tím nhạt, dịu hơn trắng tinh
const INK = NAVY;              // màu chữ chính, tiêu đề
const INK_SOFT = "#615E8C";    // chữ phụ — xám ánh tím
const INK_FADE = "#A6A3CC";    // chữ mờ, nhãn phụ
const LINE = "#E4E2F5";        // viền, đường phân cách — ánh oải hương nhạt
const DANGER = "#F43F5E";      // hồng đỏ rực — khoản chi, cảnh báo
const DANGER_ON_DARK = "#FDA4AF"; // hồng nhạt hơn, dùng trên nền gradient tối để đủ tương phản
const SUCCESS = MINT_DEEP;     // ngọc lục bảo đậm — khoản thu, số dương
const BG = PAPER;
const SERIF = "'Fraunces', Georgia, serif";
const SANS = "'Inter', -apple-system, sans-serif";

// Các gradient nền — "Cực quang số": tím than → chàm → xanh dương điện, năng động và hiện đại
const GRADIENT_APP_BG = "linear-gradient(180deg, #F8F7FF 0%, #F3F2FC 45%, #EFF6FC 100%)";
const GRADIENT_HEADER = "linear-gradient(135deg, #1E1B4B 0%, #4338CA 50%, #0EA5E9 100%)";
const GRADIENT_GOLD = "linear-gradient(135deg, #38BDF8 0%, #6366F1 55%, #4338CA 100%)"; // dùng cho nút CTA chính
const GRADIENT_SUCCESS = "linear-gradient(135deg, #6EE7B7 0%, #10B981 60%, #047857 100%)";
const GRADIENT_DANGER = "linear-gradient(135deg, #FDA4AF 0%, #F43F5E 60%, #BE123C 100%)";
const GRADIENT_NAVY_CHIP = "linear-gradient(135deg, #4338CA 0%, #1E1B4B 100%)"; // dùng cho chip/nút được chọn

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
input:focus, button:focus { outline: 2px solid ${INK}; outline-offset: 1px; }
input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.3); }
* { box-sizing: border-box; }
`;

const styles = {
  app: {
    minHeight: "100vh",
    background: GRADIENT_APP_BG,
    fontFamily: SANS,
    color: INK,
    display: "flex",
    flexDirection: "column",
    maxWidth: 480,
    margin: "0 auto",
    position: "relative",
  },
  header: {
    padding: "26px 20px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    background: GRADIENT_HEADER,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    boxShadow: "0 8px 24px rgba(11,21,38,0.28)",
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: "0.12em",
    color: "#B7B2EE",
    fontWeight: 600,
    marginBottom: 10,
  },
  balanceLabel: {
    fontSize: 13,
    color: "#CBC7F6",
    marginBottom: 2,
  },
  balanceValue: {
    fontFamily: SERIF,
    fontSize: 34,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    lineHeight: 1.1,
  },
  dong: {
    fontSize: 18,
    fontWeight: 500,
    color: "#BDB8EE",
  },
  exportBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(255,255,255,0.16)",
    color: "#FFFFFF",
    border: "1px solid rgba(255,255,255,0.38)",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
    whiteSpace: "nowrap",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    boxShadow: "0 3px 10px rgba(14,21,54,0.25)",
  },
  main: {
    flex: 1,
    padding: "20px 16px 100px",
    overflowY: "auto",
  },
  card: {
    background: `linear-gradient(${PAPER_RAISED}, ${PAPER_RAISED}), linear-gradient(135deg, #C7C2F5 0%, #A5B4F0 50%, #8FD3EE 100%)`,
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
    border: "1.5px solid transparent",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 2px 10px rgba(67,56,202,0.06)",
  },
  editingBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#EDEBFC",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 14,
    color: INK,
  },
  cancelEditBtn: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: INK_SOFT,
    display: "flex",
  },
  typeToggle: {
    display: "flex",
    gap: 8,
    marginBottom: 18,
  },
  typeBtn: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "11px 0",
    borderRadius: 10,
    border: `1.5px solid ${LINE}`,
    background: "transparent",
    color: INK_SOFT,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  typeBtnActiveChi: {
    background: GRADIENT_DANGER,
    borderColor: DANGER,
    color: "#FFF3F1",
    boxShadow: "0 3px 10px rgba(193,68,61,0.3)",
  },
  typeBtnActiveThu: {
    background: GRADIENT_SUCCESS,
    borderColor: SUCCESS,
    color: "#F0FBF6",
    boxShadow: "0 3px 10px rgba(31,122,92,0.3)",
  },
  fieldLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: INK_SOFT,
    marginBottom: 8,
    marginTop: 16,
  },
  amountRow: {
    display: "flex",
    alignItems: "baseline",
    borderBottom: `2px solid ${INK}`,
    paddingBottom: 6,
  },
  amountInput: {
    flex: 1,
    border: "none",
    background: "transparent",
    fontFamily: SERIF,
    fontSize: 32,
    fontWeight: 600,
    color: INK,
    outline: "none",
    minWidth: 0,
  },
  dongSuffix: {
    fontSize: 18,
    color: INK_SOFT,
    fontWeight: 500,
  },
  catGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 20,
    border: `1.5px solid ${LINE}`,
    background: "transparent",
    color: INK,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  catChipAdd: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "8px 14px",
    borderRadius: 20,
    border: `1.5px dashed ${INK_FADE}`,
    background: "transparent",
    color: INK_SOFT,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  newCatRow: {
    display: "flex",
    gap: 8,
    marginTop: 10,
  },
  newCatInput: {
    flex: 1,
    padding: "9px 12px",
    borderRadius: 8,
    border: `1.5px solid ${LINE}`,
    fontSize: 13,
    fontFamily: SANS,
    background: PAPER,
  },
  newCatSave: {
    padding: "9px 16px",
    borderRadius: 8,
    border: "none",
    background: INK,
    color: PAPER_RAISED,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  dateInput: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1.5px solid ${LINE}`,
    fontSize: 14,
    fontFamily: SANS,
    background: PAPER,
    color: INK,
  },
  noteInput: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1.5px solid ${LINE}`,
    fontSize: 14,
    fontFamily: SANS,
    background: PAPER,
    color: INK,
  },
  submitBtn: {
    width: "100%",
    marginTop: 22,
    padding: "14px 0",
    borderRadius: 12,
    border: "none",
    color: "#F6F9FC",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.01em",
    boxShadow: "0 6px 16px rgba(11,21,38,0.2)",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: INK,
    marginBottom: 12,
    fontFamily: SERIF,
    letterSpacing: "0.01em",
  },
  txRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: `linear-gradient(${PAPER_RAISED}, ${PAPER_RAISED}), linear-gradient(135deg, #C7C2F5 0%, #A5B4F0 50%, #8FD3EE 100%)`,
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
    border: "1.5px solid transparent",
    borderRadius: 12,
    padding: "12px 14px",
    boxShadow: "0 2px 8px rgba(67,56,202,0.05)",
  },
  txIconBadge: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  txCat: {
    fontSize: 14,
    fontWeight: 600,
    color: INK,
  },
  txMeta: {
    fontSize: 11.5,
    color: INK_FADE,
    marginTop: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  txAmount: {
    fontSize: 14,
    fontWeight: 700,
    fontFamily: SERIF,
    whiteSpace: "nowrap",
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: INK_FADE,
    cursor: "pointer",
    padding: 4,
    display: "flex",
  },
  filterRow: {
    display: "flex",
    gap: 8,
    marginBottom: 18,
  },
  filterChip: {
    padding: "7px 16px",
    borderRadius: 20,
    border: `1.5px solid ${LINE}`,
    background: "transparent",
    color: INK_SOFT,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  filterChipActive: {
    background: GRADIENT_NAVY_CHIP,
    borderColor: INK,
    color: PAPER_RAISED,
  },
  dateGroupLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: INK_SOFT,
    marginBottom: 8,
    textTransform: "capitalize",
  },
  modeToggle: {
    display: "flex",
    gap: 6,
    background: "#EDEBFC",
    borderRadius: 10,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    padding: "8px 0",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: INK_SOFT,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  modeBtnActive: {
    background: PAPER_RAISED,
    color: INK,
    boxShadow: "0 1px 2px rgba(38,54,47,0.1)",
  },
  periodRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  periodArrow: {
    background: PAPER_RAISED,
    border: `1px solid ${LINE}`,
    borderRadius: 8,
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: INK,
  },
  periodLabel: {
    fontFamily: SERIF,
    fontSize: 17,
    fontWeight: 600,
    color: INK,
    textTransform: "capitalize",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  statCard: {
    background: `linear-gradient(${PAPER_RAISED}, ${PAPER_RAISED}), linear-gradient(135deg, #C7C2F5 0%, #A5B4F0 50%, #8FD3EE 100%)`,
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
    border: "1.5px solid transparent",
    borderRadius: 12,
    padding: "12px 10px",
    boxShadow: "0 2px 8px rgba(67,56,202,0.05)",
  },
  statLabel: {
    fontSize: 11,
    color: INK_SOFT,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: SERIF,
    fontSize: 17,
    fontWeight: 700,
  },
  legendWrap: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: INK,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    flexShrink: 0,
  },
  budgetHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  budgetCatName: {
    fontFamily: SERIF,
    fontSize: 15,
    fontWeight: 600,
    color: INK,
  },
  overBadge: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    color: DANGER,
    background: "#FBE4E1",
    padding: "3px 8px",
    borderRadius: 20,
  },
  budgetInputRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  budgetInputLabel: {
    fontSize: 12,
    color: INK_SOFT,
    whiteSpace: "nowrap",
  },
  budgetInput: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 8,
    border: `1.5px solid ${LINE}`,
    fontSize: 13,
    fontFamily: SANS,
    background: PAPER,
    color: INK,
  },
  progressTrack: {
    height: 8,
    borderRadius: 20,
    background: "#EDEBFC",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 20,
    transition: "width 0.3s ease",
  },
  budgetSpentRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: INK_SOFT,
    marginTop: 6,
  },
  nav: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 480,
    display: "flex",
    background: PAPER_RAISED,
    borderTop: `1px solid ${LINE}`,
    padding: "10px 0 max(10px, env(safe-area-inset-bottom))",
  },
  navBtn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "6px 0",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "40px 20px",
    color: INK_FADE,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    color: INK_SOFT,
    maxWidth: 240,
  },
  recurringIntro: {
    fontSize: 13,
    color: INK_SOFT,
    lineHeight: 1.5,
  },
  addRecurringBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    padding: "13px 0",
    borderRadius: 12,
    border: `1.5px dashed ${INK_FADE}`,
    background: "transparent",
    color: INK,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  recurringRowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  recurringCatName: {
    fontFamily: SERIF,
    fontSize: 15,
    fontWeight: 600,
    color: INK,
  },
  recurringMeta: {
    fontSize: 12,
    color: INK_FADE,
    marginTop: 3,
  },
  recurringAmount: {
    fontFamily: SERIF,
    fontSize: 16,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  recurringActions: {
    display: "flex",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTop: `1px solid ${LINE}`,
  },
  recurringActionBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 10px",
    borderRadius: 8,
    border: `1px solid ${LINE}`,
    background: "transparent",
    color: INK_SOFT,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  exportPresetGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  exportPresetChip: {
    padding: "9px 16px",
    borderRadius: 20,
    border: `1.5px solid ${LINE}`,
    background: PAPER_RAISED,
    color: INK,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  exportRangeLabel: {
    fontSize: 13,
    color: INK_SOFT,
    marginBottom: 12,
  },
  exportSubmitBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "15px 0",
    borderRadius: 12,
    border: "none",
    background: GRADIENT_GOLD,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(67,56,202,0.28)",
  },
  toast: {
    position: "fixed",
    bottom: 90,
    left: "50%",
    transform: "translateX(-50%)",
    background: INK,
    color: PAPER_RAISED,
    padding: "10px 18px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    boxShadow: "0 4px 16px rgba(38,54,47,0.25)",
    zIndex: 50,
  },
};
