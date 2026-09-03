/**
 * DESIGN TOKENS — nguồn sự thật duy nhất cho màu / khoảng cách / bo góc / chữ.
 *
 * ĐỔI BỘ NHẬN DIỆN CHO MỘT TRƯỜNG = SỬA ĐÚNG FILE NÀY RỒI BUILD LẠI.
 * Không lấy màu từ backend (quyết định 25/08/2026): nhận diện là việc build-time
 * per-tenant, không phải runtime.
 *
 * Vì sao là `.js` chứ không phải `.ts`: `tailwind.config.js` chạy trong Node lúc
 * build và `require()` file này — Node không parse được TypeScript. Kiểu dữ liệu
 * khai báo ở `tokens.d.ts` bên cạnh, nên phía TS vẫn được gợi ý đầy đủ.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ NGỮ NGHĨA `primary` / `secondary`
 *
 * Bộ token này theo ĐÚNG quy ước của web (`frappe-sis-frontend/src/styles/tokens.css`
 * và DocType `ERP Branding Settings`):
 *
 *     brand           = CAM  #F05023   (web gọi là --color-primary)
 *     brand.secondary = NAVY #002855   (web gọi là --color-secondary)
 *
 * Trong khi đó `tailwind.config.js` của mobile từ trước tới nay lại đặt NGƯỢC LẠI
 * (`primary` = navy, `secondary` = cam) và đang có ~59 callsite dùng theo nghĩa cũ.
 *
 * Nên: KHÔNG đụng vào `primary`/`secondary` cũ. Chúng được giữ nguyên và đánh dấu
 * deprecated trong `tailwind.config.js`. Code mới (ui-v2) chỉ dùng nhóm `brand-*`
 * và các token ngữ nghĩa bên dưới. Việc gỡ bỏ cặp cũ diễn ra dần ở GĐ3, mỗi màn
 * một PR — không làm một lượt để tránh đổi màu toàn app trong một commit.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Thang xám nền tảng. Không dùng trực tiếp trong component — đi qua token ngữ nghĩa bên dưới. */
const neutral = {
  0: '#FFFFFF',
  50: '#FAFAFA',
  100: '#F8F8F8',
  200: '#E5E7EB',
  300: '#D1D5DB',
  400: '#9CA3AF',
  500: '#757575',
  600: '#6B7280',
  700: '#374151',
  800: '#1F2937',
  900: '#0A2240',
};

const color = {
  /** Màu thương hiệu chính — CAM. Khớp `--color-primary` của web. */
  brand: {
    DEFAULT: '#F05023',
    hover: '#D8421A',
    active: '#C2380F',
    50: '#FEE8E0',
    100: '#FDD1C2',
    /** Chữ/icon đặt TRÊN nền brand. */
    foreground: '#FFFFFF',
  },

  /** Màu thương hiệu phụ — NAVY. Khớp `--color-secondary` của web. */
  brandSecondary: {
    DEFAULT: '#002855',
    hover: '#001A3C',
    50: '#E5EAF0',
    foreground: '#FFFFFF',
  },

  /** Màu nhấn — VÀNG. */
  accent: {
    DEFAULT: '#F5AA1E',
    hover: '#DB9415',
    50: '#FEF1D8',
    bright: '#FFCE02',
    foreground: '#FFFFFF',
  },

  /** Trạng thái. Giữ nguyên giá trị của web để hai sản phẩm đọc giống nhau. */
  success: { DEFAULT: '#3DB838', 50: '#E2F4DD' },
  danger: { DEFAULT: '#DC0909', 50: '#FAD5D5' },
  warning: { DEFAULT: '#F5AA1E', 50: '#FEF1D8' },
  info: { DEFAULT: '#1072E0', 50: '#DCE9F9' },

  /**
   * Nền — theo ngôn ngữ thẻ nổi trên nền xám (xem §NGÔN NGỮ THIẾT KẾ cuối file):
   *
   *   page    xám nhạt   ← nền màn hình
   *   DEFAULT trắng      ← nền THẺ nổi lên trên `page`
   *   subtle  xám rất nhạt ← ô nhập / chip nằm BÊN TRONG thẻ trắng
   *
   * Độ sâu đến từ tương phản nền, không phải từ đổ bóng. Bóng chỉ dùng cho vật
   * thật sự nổi (FAB, thanh đáy), khai báo ở `elevation`.
   */
  surface: {
    page: '#F2F3F5',
    DEFAULT: neutral[0],
    subtle: neutral[100],
    muted: '#F3F4F6',
    inset: neutral[50],
  },

  /** Chữ. RN không kế thừa màu chữ từ cha — luôn đi qua atom `AppText`. */
  content: {
    emphasized: neutral[900],
    DEFAULT: neutral[800],
    normal: neutral[700],
    description: neutral[500],
    disabled: neutral[400],
    inverse: neutral[0],
  },

  /** Viền. */
  line: {
    subtle: neutral[200],
    DEFAULT: neutral[300],
    strong: neutral[400],
  },

  /**
   * Lớp phủ trong suốt. Buộc phải có alpha vì chúng nằm chồng lên nội dung tuỳ ý
   * (ảnh, nền màu thương hiệu) — màu đặc sẽ che mất.
   */
  overlay: {
    /** Ô nhỏ nổi trên nền màu thương hiệu, vd con số trong chip đang chọn. */
    onBrand: 'rgba(255, 255, 255, 0.24)',
    /** Nền tối phía sau sheet. */
    scrim: 'rgba(10, 34, 64, 0.45)',
  },

  neutral,
};

/** Thang khoảng cách — giữ đúng thang số của web để hai bên nói cùng ngôn ngữ. */
const space = {
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
};

const radius = {
  4: 4,
  6: 6,
  8: 8,
  12: 12,
  14: 14,
  16: 16,
  /** Bo góc chuẩn của THẺ. Rộng rãi — đây là nét nhận dạng chính của ngôn ngữ thiết kế. */
  20: 20,
  24: 24,
  28: 28,
  /** Mọi thứ bấm được mà không phải thẻ đều bo tròn hết: nút, chip, tab, badge. */
  full: 9999,
};

/**
 * Đổ bóng. RN cần cả `shadow*` (iOS) lẫn `elevation` (Android) nên gói sẵn thành
 * object trải thẳng vào `style`.
 *
 * Dùng RẤT TIẾT KIỆM: thẻ lấy độ sâu từ tương phản nền (`surface.page` vs
 * `surface.DEFAULT`). Chỉ vật thật sự bay lên trên nội dung mới cần bóng.
 */
const elevation = {
  /** FAB, thanh hành động đáy. */
  floating: {
    shadowColor: '#0A2240',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  /** Sheet, popup. */
  overlay: {
    shadowColor: '#0A2240',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
};

/**
 * Chữ. Mỗi variant là một "gói" đầy đủ: cỡ + giãn dòng + family.
 *
 * RN không suy ra được font đậm/nhạt từ `fontWeight` với font tuỳ biến — phải chỉ
 * đích danh file family. Vì vậy weight nằm trong `fontFamily`, không phải `fontWeight`.
 */
const fontFamily = {
  regular: 'Mulish-Regular',
  medium: 'Mulish-Medium',
  semibold: 'Mulish-SemiBold',
  bold: 'Mulish-Bold',
  extrabold: 'Mulish-ExtraBold',
};

const typography = {
  title1: { fontSize: 24, lineHeight: 30, fontFamily: fontFamily.bold },
  title2: { fontSize: 20, lineHeight: 26, fontFamily: fontFamily.bold },
  title3: { fontSize: 17, lineHeight: 22, fontFamily: fontFamily.bold },
  headline: { fontSize: 15, lineHeight: 20, fontFamily: fontFamily.semibold },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fontFamily.regular },
  footnote: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular },
  caption: { fontSize: 11, lineHeight: 14, fontFamily: fontFamily.medium },
};

/**
 * Vùng chạm tối thiểu: 44pt (iOS HIG) — Material là 48dp nhưng 44 + hitSlop là đủ
 * cho cả hai. Mọi atom bấm được phải bảo đảm con số này.
 */
const layout = {
  minTouch: 44,
  /** Chiều cao chuẩn của nút và ô nhập một dòng. */
  controlHeight: 48,
  controlHeightSm: 36,
  /** Lề ngang chuẩn của nội dung màn hình. */
  screenPadding: 20,
};

module.exports = { color, space, radius, typography, fontFamily, layout, elevation };

/**
 * ────────────────────────────────────────────────────────────────────────────
 * §NGÔN NGỮ THIẾT KẾ  (chốt 25/08/2026, từ concept tham khảo do PO đưa)
 *
 * Concept gốc: app dashboard bán vé — cam + navy trên nền xám nhạt. Trùng gần như
 * chính xác cặp màu thương hiệu đang có, nên lấy làm chuẩn cho ui-v2.
 *
 * 1. NỀN XÁM, THẺ TRẮNG. Màn hình nền `surface.page`; nội dung gom vào thẻ trắng
 *    `surface.DEFAULT`. Độ sâu đến từ tương phản, không phải viền hay bóng.
 *
 * 2. BO GÓC RỘNG. Thẻ `radius.20`. Mọi control bấm được (nút, chip, tab, badge)
 *    dùng `radius.full` — dáng viên thuốc là nét nhận dạng chính.
 *
 * 3. TRẠNG THÁI CHỌN = TÔ ĐẶC. Chip/tab đang chọn tô kín `brand` hoặc
 *    `brandSecondary` + chữ `foreground`. Chưa chọn thì nền `surface.subtle`,
 *    chữ `content.description`. Không dùng viền để thể hiện đang chọn.
 *
 * 4. SỐ LIỆU LÀ NHÂN VẬT CHÍNH. Con số to, đậm, màu `content.emphasized`; nhãn
 *    nhỏ, xám, đặt phía trên. Không cho nhãn to ngang số.
 *
 * 5. TIẾT CHẾ MÀU. Cam và navy là điểm nhấn, không phải nền diện rộng. Một màn
 *    chỉ nên có một–hai mảng màu thương hiệu; phần còn lại là trắng/xám/chữ đậm.
 *
 * 6. ICON TRONG Ô BO TRÒN. Icon đứng một mình thì đặt trong ô vuông bo tròn nền
 *    `surface.subtle` hoặc nền màu nhạt (`brand.50`, `accent.50`) — không thả trôi.
 *
 * 7. THANH TIẾN TRÌNH MẢNH. Chỉ số kèm thanh 4px bo tròn dưới chân, phần đã đạt
 *    tô màu thương hiệu, phần còn lại `surface.muted`.
 *
 * 8. HÀNH ĐỘNG CHÍNH Ở ĐÁY, TRÀN NGANG, DÁNG VIÊN THUỐC.
 * ────────────────────────────────────────────────────────────────────────────
 */
