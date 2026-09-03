# Component Architecture — ui-v2 (mobile)

> Đọc file này trước khi tạo component mới trong `src/components/ui-v2/`.
>
> Phần **nguyên tắc phân tầng** kế thừa từ bản web
> (`frappe-sis-frontend/docs/component-architecture.md`) — không chép lại ở đây.
> Phần **catalog và hình hài component** thì khác hẳn: web là chuột + trang cuộn
> vô hạn, mobile là ngón tay trên màn 6 inch.

## TL;DR

```
@atoms (L0) ──► @molecules (L1) ──► @organisms (L2) ──► @templates (L3)
```

- Level N chỉ được import từ level **< N**.
- Mỗi level có `index.ts` gom export. Consumer import từ alias, **không** đi vào path sâu.
- Không hex, không `text-xs`, không `text-gray-*`. Mọi giá trị đến từ `src/theme/tokens.js`.
- Chỉ tạo component khi đã có **callsite thật**.

---

## 1. Tầng token

`src/theme/tokens.js` là nguồn sự thật duy nhất cho màu / khoảng cách / bo góc / chữ.
**Đổi bộ nhận diện cho một trường = sửa đúng file đó rồi build lại.** Màu KHÔNG lấy
từ backend — đây là quyết định có chủ đích (nhận diện là việc build-time per-tenant).

Là `.js` chứ không phải `.ts` vì `tailwind.config.js` chạy trong Node và `require()`
nó lúc build; kiểu dữ liệu nằm ở `tokens.d.ts` bên cạnh.

### ⚠️ `primary` / `secondary` đang có hai nghĩa ngược nhau

| | `primary` | `secondary` |
|---|---|---|
| `tokens.js` → `brand` / `brand-secondary` (**dùng cái này**) | CAM `#F05023` | NAVY `#002855` |
| `tailwind.config.js` → `primary` / `secondary` (**legacy**) | NAVY `#002855` | CAM `#F05023` |

Nhóm `brand-*` theo đúng quy ước của web và của `ERP Branding Settings`. Cặp
`primary`/`secondary` cũ giữ lại chỉ vì ~59 callsite ở màn V1 còn phụ thuộc; gỡ dần
theo từng màn, **không** sửa một lượt (sẽ đổi màu toàn app trong một commit).

### Ngôn ngữ thiết kế

8 quy tắc thị giác (nền xám–thẻ trắng, bo góc rộng, chọn = tô đặc, số liệu là nhân
vật chính…) ghi ở cuối `src/theme/tokens.js`, mục `§NGÔN NGỮ THIẾT KẾ`. Đọc trước
khi dựng màn mới.

---

## 2. Mobile khác web ở đâu

Tám ràng buộc này quyết định vì sao catalog mobile không phải bản dịch của catalog web:

| # | Ràng buộc | Hệ quả |
|---|---|---|
| 1 | RN `<Text>` **không kế thừa** style từ cha | `AppText` là atom bắt buộc — chỗ duy nhất ép được typography + màu chữ. Không dùng `<Text>` trần |
| 2 | Không có hover / focus-ring | Phản hồi chạm là `activeOpacity` của `TouchableOpacity`, không phải `:hover`. **Đừng dùng `Pressable`** — xem §2.1 |
| 3 | Vùng chạm ≥ 44×44pt (iOS HIG) | Atom nút tự bảo đảm + `hitSlop`; callsite không phải nhớ |
| 4 | Không có dropdown/popover tử tế | Mọi lựa chọn đổ xuống **bottom sheet** |
| 5 | `Modal` lồng nhau **treo app trên iOS** | Xem §4 — đây là lỗi nguy hiểm nhất của tầng này |
| 6 | Danh sách dài phải virtualize | `FlatList` + kéo-để-làm-mới + tải-thêm là MỘT organism, không phải bảng + phân trang |
| 7 | Safe-area + bàn phím | Template L3 gánh, không để mỗi màn tự lo |
| 8 | Không có CSS variable, không media query | Token là object TS; chỉ portrait nên không có breakpoint |

Hệ quả: **đừng port `DataTable`, `DropdownMenu`, `Popover`, `Pagination`, `Tooltip`
từ web sang.** Nếu thấy mình đang gõ một trong những cái tên đó, dừng lại và đối
chiếu bảng trên.

### 2.1 ⚠️ NativeWind nuốt dạng hàm của `style` trên `Pressable`

Với `nativewind@4.2.1` + `jsxImportSource: 'nativewind'`, mọi JSX đi qua transform
của NativeWind. `Pressable` bị bọc `cssInterop`, và dạng **hàm** của prop `style`
bị bỏ luôn — **toàn bộ** style của component đó biến mất:

```tsx
// ❌ Style KHÔNG được áp dụng. Không báo lỗi, không cảnh báo — chỉ là mất sạch.
<Pressable style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.7 : 1 }]} />

// ✅
<TouchableOpacity activeOpacity={0.7} style={[styles.chip]} />
```

Triệu chứng rất dễ đọc nhầm thành lỗi layout: chip mất nền và icon rớt xuống dưới
chữ (vì mất `flexDirection: 'row'`), FAB rơi về góc trái trên (mất `position:
absolute`), thẻ mất bo góc. `View` và `Text` **không** dính lỗi này, nên trong cùng
một màn sẽ có chỗ đúng chỗ sai — càng dễ đổ cho nguyên nhân khác.

Quy ước: trong `ui-v2` **không dùng `Pressable`**. Vùng chạm dùng `TouchableOpacity`
với style thuần (mảng/đối tượng).

---

## 3. Catalog

### L0 — Atoms (`@atoms`)

| Component | Vai trò |
|---|---|
| `AppText` | Chữ. 7 variant: `title1/2/3`, `headline`, `body`, `footnote`, `caption` |
| `ButtonPrimary` `ButtonSecondary` `ButtonDanger` `ButtonGhost` | Nút dáng viên thuốc, cao ≥ 48 |
| `IconButton` | Nút chỉ có icon, luôn đủ 44pt vùng chạm |
| `Icon` | Một cửa lấy icon — bộ icon-v2 dùng chung với web, fallback Ionicons/MCI (xem §3.1) |
| `TextField` | Ô nhập một dòng, có `leadingIcon` và slot `trailing` |
| `Card` | Thẻ trắng bo 20 — đơn vị bố cục cơ bản |
| `Avatar` | Ảnh đại diện, không có ảnh thì hiện chữ cái đầu |
| `Divider` | Đường kẻ mảnh |
| `Spinner` | Vòng quay chờ, có nhãn tuỳ chọn |
| `Badge` | Nhãn nhỏ viên thuốc, `soft` / `solid`, có chấm trạng thái |
| `ProgressBar` | Thanh tiến trình mảnh dưới chân chỉ số |

### 3.1 Bộ icon dùng chung với web

134 icon Iconly lấy từ `frappe-sis-frontend/public/icon-v2`, đồng bộ bằng:

```bash
node scripts/sync-icons-from-web.mjs
```

Script copy SVG sang `src/assets/icon-v2/` và sinh `iconRegistry.ts` (file sinh tự
động — đừng sửa tay). Web tô màu icon bằng `filter` CSS đơn sắc; RN không có filter
đó nên script đổi mọi fill/stroke sang `currentColor` để tô bằng prop `color` —
kết quả thị giác như nhau.

```tsx
<Icon name="search" />                    // icon-v2
<Icon name="laptop" tone="brand" />
<Icon name="alert-circle" />              // không có trong icon-v2 → tự rơi về Ionicons
<Icon name="toolbox" set="mci" />         // ép dùng MaterialCommunityIcons
```

`set="auto"` (mặc định) tra icon-v2 trước rồi mới fallback. Fallback là **im lặng**:
gõ sai tên sẽ ra icon Ionicons hoặc ô trống chứ không báo lỗi — kiểu `IconV2Name`
chỉ gợi ý, không chặn, vì prop còn phải nhận tên của hai bộ font kia.

Bộ icon-v2 hiện **chưa có**: logo hãng (Apple…), máy chiếu, hộp đồ nghề, và các
icon cảnh báo (`alert-circle`, `warning`). Những chỗ đó đang dùng fallback hoặc
icon gần nghĩa — muốn chuẩn hoá thì bổ sung ở web rồi chạy lại script.

### L1 — Molecules (`@molecules`)

| Component | Vai trò |
|---|---|
| `ListRow` | Hàng danh sách dạng thẻ: leading · title · subtitle · status · footer |
| `FormField` | Nhãn + dấu bắt buộc + ô nhập + dòng lỗi/gợi ý |
| `SearchBar` | Ô tìm kiếm + nút xoá + nút lọc + dòng tóm tắt bộ lọc |
| `FilterChipRow` | Dải chip **chọn một**, cuộn ngang |
| `SelectableChip` / `CheckRow` | Chip **chọn nhiều** / hàng có ô tick — dùng trong sheet lọc |
| `StatusBadge` + `resolveStatus` | Nhãn trạng thái. Bảng tra là dữ liệu nghiệp vụ, màn hình truyền vào |
| `InlineAlert` | Băng thông báo trong luồng nội dung (khác toast nổi) |

### L2 — Organisms (`@organisms`)

| Component | Vai trò |
|---|---|
| `RefreshableList` | `FlatList` + kéo-để-làm-mới + tải-thêm + rỗng + đang tải, gộp làm một |
| `AppSheet` | Sheet trượt từ đáy: header · body cuộn · footer. Xem §4 |
| `useSheetQueue` | Bảo đảm **không bao giờ có hai `Modal` cùng sống**. Xem §4 |
| `AppHeader` | Thanh tiêu đề, hai bên cố định để tiêu đề căn giữa thật |
| `EmptyState` | Trạng thái rỗng có chỗ cho hành động — không phải ngõ cụt |
| `Fab` + `FAB_CLEARANCE` | Nút nổi góc phải dưới, tự cộng safe-area |
| `SectionCard` | Thẻ có tiêu đề, gom nội dung theo nhóm |

### L3 — Templates (`@templates`)

| Component | Gánh hộ màn hình |
|---|---|
| `ListScreen` | safe-area · `AppHeader` · toolbar dính · danh sách · lớp nổi · overlay |
| `FormScreen` | safe-area · `AppHeader` · `KeyboardAvoidingView` · nội dung cuộn · thanh nút dính đáy |

#### Sheet hay trang cho biểu mẫu?

| | Dùng |
|---|---|
| Chọn nhanh, ≤ 3–4 ô, ít gõ | `AppSheet` |
| Từ ~5 ô trở lên, nhiều ô nhập chữ | `FormScreen` + `presentation: 'modal'` |

Bàn phím nuốt ~40% màn hình; sheet vốn chỉ cao 85% nên biểu mẫu dài trong sheet
không đủ chỗ vừa thấy ô đang gõ vừa thấy nút gửi. Thêm nữa, cuộn dài trong sheet
đánh nhau với cử chỉ kéo-xuống-để-đóng, và lỡ tay là mất trắng phần đã điền.

Callsite mẫu: [`DeviceCreateScreen`](../src/screens/Devices/DeviceCreateScreen.tsx)
— 9 ô nhập, trước là hộp thoại nổi giữa màn kiểu web.

---

## 4. ⚠️ Luật `Modal` lồng nhau trên iOS

**Mở `Modal` thứ hai trong khi `Modal` thứ nhất chưa tháo xong sẽ treo app** — màn
xám, không bấm được gì, phải kill app. **Android không tái hiện được**, nên lỗi này
lọt qua mọi vòng test không chạy trên iOS.

Chỉ có hai cách hợp lệ:

1. Sheet con nằm **bên trong** cây con của sheet cha (cùng một `Modal`).
2. Đóng sheet cha, **chờ `onClosed`**, rồi mới mở sheet kế.

```tsx
// ❌ TREO APP trên iOS
onPress={() => { setShowFilter(false); setShowCreate(true); }}

// ✅ Dùng hàng đợi
const sheet = useSheetQueue<'filter' | 'create'>();

<AppSheet
  visible={sheet.isOpen('filter')}
  onClose={sheet.close}
  onClosed={sheet.handleClosed}   // ← thiếu dòng này thì sheet kế không bao giờ mở
/>
```

`onClosed` bắn sau khi animation đóng chạy xong **và** `Modal` đã tháo khỏi cây —
khác `onClose` (bắn ngay lúc người dùng bấm). Đặt mọi sheet của màn vào prop
`overlays` của template để chúng luôn là anh em ruột, không lồng nhau.

---

## 5. Quy trình tạo component mới

1. **Xác định level** — dừng ở câu đầu tiên trả lời "Có":
   - Biết khái niệm nghiệp vụ ("thiết bị", "học sinh", "phiếu")? → **không thuộc `ui-v2`**,
     đặt cạnh màn hình dùng nó (xem `src/screens/Devices/components/DeviceFilterSheet.tsx`).
   - Là khuôn nguyên màn hình? → **L3**.
   - Ghép từ ≥ 2 molecule/organism? → **L2**.
   - Ghép từ ≥ 2 atom? → **L1**.
   - Còn lại → **L0**.
2. **Đặt vào sub-folder domain** (`buttons/`, `fields/`, `rows/`, `sheets/`…). Chưa có
   sub-folder phù hợp và sẽ có ≥ 3 component cùng loại thì tạo mới; one-off thì để thẳng.
3. **Re-export trong `index.ts`** của level (cả component lẫn type).
4. **Kiểm import**: chỉ được từ level thấp hơn hoặc bằng, hoặc package ngoài.
5. **Cập nhật §3** của file này.

---

## 6. Anti-pattern

| ❌ Đừng | ✅ Thay vì |
|---|---|
| `<Text>` trần | `<AppText variant=… />` |
| `#F05023`, `text-[#002855]` | token trong `tokens.js` |
| `text-xs` / `text-sm` / `text-gray-500` | `variant` + `tone` của `AppText` |
| `<Ionicons color="#666" />` | `<Icon tone="description" />` |
| `ActivityIndicator` gọi thẳng | `<Spinner />` |
| Tự nối `FlatList` + `RefreshControl` + empty | `<RefreshableList />` |
| `setShowA(false); setShowB(true)` | `useSheetQueue` (§4) |
| `SafeAreaView` trong từng màn | template L3 |
| Atom có prop `deviceName`, `studentId` | atom nhận prop generic; nghiệp vụ bọc ở ngoài |
| Tạo atom trước rồi đi tìm chỗ dùng | chỉ tạo khi đã có callsite thật |
| Port `DataTable` / `DropdownMenu` từ web | đối chiếu §2 |

---

## 7. Kiểm trước khi merge

```bash
npx eslint "src/components/ui-v2/**/*.{ts,tsx}"
```

```bash
grep -rnE "#[0-9A-Fa-f]{6}\b|rgba?\(" src/components/ui-v2/
```

```bash
grep -rn "@molecules\|@organisms\|@templates" src/components/ui-v2/level-0-atoms/
```

Ba lệnh trên phải sạch. `npx tsc --noEmit` **không dùng được** ở repo này — có ~933 lỗi
baseline do kiểu của `react-native` không resolve (`moduleResolution: "bundler"`),
xuất hiện cả ở file chưa ai đụng tới. Tín hiệu thật là ESLint + Metro bundle được.

Màn có sheet lồng nhau **bắt buộc test trên iOS** — luật §4 chỉ vỡ ở iOS.

---

## 8. Trạng thái

| Đợt | Trạng thái | Nội dung |
|---|---|---|
| 1 | ✅ | Tầng token + L0 (11 atom) + L1 (6) + L2 (7) + L3 (`ListScreen`) |
| 1 | ✅ | Bộ 134 icon dùng chung với web + script đồng bộ |
| 1 | ✅ | Màn mẫu `DevicesScreenV2` — công tắc V1/V2 ở `src/config/uiV2.ts` |
| 2 | ✅ | `FormScreen` + `FormField` — callsite `DeviceCreateScreen` |
| 2 | 🔜 | `DetailScreen`, `SelectField`, `DateField`, `SegmentedTabs` |
| 3 | 🔜 | Migrate `Login` → `Exchange` → `CRMIssue` → `AdministrativeTicket` → `Ticket` |

Bối cảnh dài hạn và lộ trình đầy đủ: xem kế hoạch đánh giá nhận diện đi kèm.
