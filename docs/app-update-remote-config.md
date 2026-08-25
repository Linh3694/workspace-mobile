# Quản lý nhắc / ép cập nhật từ xa (remote config) — app GV (Wis)

Mục tiêu: đổi mức độ ép cập nhật **lúc nào cũng được**, áp dụng cho các bản app đã
nằm trên máy nhân viên, **không phải chờ phát hành bản mới**.

> **Đang chốt (17/08/2026): CHỈ NHẮC** — popup vẫn có nút "Để sau".
> Đặt ở hai chỗ cho khớp nhau: `EXPO_PUBLIC_APP_UPDATE_FORCE=false` trong `eas.json`
> (mặc định lúc build, dùng khi máy chủ không trả được chính sách) và `"force": false`
> trong file JSON trên máy chủ (thứ thật sự điều khiển lúc chạy).
> File sẵn sàng upload: [`docs/app-update-wis.json`](./app-update-wis.json).

Bản dành cho app phụ huynh nằm ở repo `parent-portal-mobile`, cùng cơ chế nhưng
**khác file** (`app-update.json` vs `app-update-wis.json`) — hai app dùng chung một
host nhưng đánh số phiên bản khác hẳn nhau, dùng chung file là ép nhầm nhau.

## Trước đây sai ở đâu

App **chưa bao giờ ép được** ai cập nhật: `mandatory` chỉ bật khi có `minimumVersion`,
mà `minimumVersion` chỉ đến từ remote config, mà remote config chỉ bật khi có
`EXPO_PUBLIC_APP_UPDATE_CONFIG_URL` — biến này chưa từng được set ở `.env` lẫn
`eas.json`. Cả nhánh đó chưa chạy lần nào.

Cùng lúc đó backend đã có sẵn `erp.api.erp_sis.app_version` với `min_version`, nhưng
app **không gọi** endpoint này.

## Bây giờ chạy thế nào

**Lớp A — chính sách** (`enabled` / `force` / `minimumVersion`): đọc từ
`{API_BASE}/files/app-update-wis.json` ở mỗi lần kiểm tra. Không cần biến môi trường —
app tự dựng URL từ base API đã nhúng trong binary. Set
`EXPO_PUBLIC_APP_UPDATE_CONFIG_URL` thì dùng URL đó thay thế (để test).

**Lớp B — phiên bản mới nhất**: nếu chính sách không ghi `latestVersion` thì hỏi
**song song** hai nguồn rồi **lấy bản cao hơn**:

| Nguồn | Cho gì | Điểm yếu |
|---|---|---|
| `erp.api.erp_sis.app_version.get_latest_version?app_id=wis_staff` | `version`, `min_version`, `store_url` | Bảng chép tay trong `app_version.py`, hay bị quên cập nhật |
| App Store (iTunes Lookup) / Google Play (dò HTML) | version mới nhất, luôn tươi | Không có `min_version`; nguồn Play dò HTML, hỏng lúc nào không báo |

Lấy bản cao hơn để tránh cả hai kiểu hỏng. Ví dụ đo ngày 17/08/2026: backend ghi
**1.5.28** trong khi App Store đã **1.5.41** — nếu chỉ tin backend thì mọi máy từ
1.5.29 đến 1.5.40 sẽ không bao giờ được nhắc.

> Nên dọn: cập nhật `APP_VERSIONS` trong `erp/api/erp_sis/app_version.py` cho khớp
> store, hoặc bỏ hẳn `version` ở đó và chỉ giữ `min_version`.

## Nội dung file JSON

Tất cả các trường đều không bắt buộc. Bỏ trống trường nào thì giữ hành vi mặc định.

```jsonc
{
  "enabled": true,          // false → tắt hẳn popup cập nhật (công tắc khẩn)
  "force": false,           // true → mọi bản mới đều bắt buộc; false → chỉ nhắc
                            // bỏ trống → theo mặc định build-time (hiện là false)
  "minimumVersion": "1.5.40", // dưới mức này thì bắt buộc, kể cả khi force=false
  "latestVersion": "1.5.42",  // ghi đè — KHUYÊN BỎ TRỐNG, để backend/store tự báo
  "storeUrl": "https://apps.apple.com/app/id6746143732",
  "storeDeepLink": "itms-apps://itunes.apple.com/app/id6746143732",

  // Khối riêng theo nền tảng — ghi đè khối chung ở trên
  "ios":     { "force": true },
  "android": { "force": false }
}
```

Alias chấp nhận được: `version` = `latestVersion`, `minVersion` = `minimumVersion`,
`forceUpdate` = `force`. Trường `releaseNotes` đọc được nhưng `UpdateRequiredModal`
hiện chưa hiển thị, điền vào cũng chưa ai thấy.

Quy tắc quyết định popup:

- Chỉ hiện khi `latestVersion` > phiên bản đang cài.
- **Bắt buộc** khi `force === true`, **hoặc** `minimumVersion` > phiên bản đang cài
  (`minimumVersion` là sàn cứng, `force: false` không gỡ được). Lưu ý `min_version`
  của backend cũng tính là `minimumVersion` — hiện đang để `1.0.0` nên vô hiệu.
- `enabled: false` → không hiện gì cả, kể cả bản bắt buộc.

## Các kịch bản hay dùng

**Chỉ nhắc, cho bấm "Để sau"** — ĐANG DÙNG, đúng nội dung `docs/app-update-wis.json`

```json
{ "enabled": true, "force": false }
```

**Ép toàn bộ** (bản vá lỗi nghiêm trọng)

```json
{ "force": true }
```

**Ép có sàn** — ai dưới 1.5.42 phải lên, từ 1.5.42 trở lên chỉ được nhắc

```json
{ "force": false, "minimumVersion": "1.5.42" }
```

**Công tắc khẩn** — bản vừa lên store bị lỗi, tắt popup để không đẩy nhân viên sang
bản hỏng

```json
{ "enabled": false }
```

## Chỗ đặt file

Chép [`docs/app-update-wis.json`](./app-update-wis.json) vào `sites/<site>/public/files/`
của server Frappe sao cho mở được ở
`https://prod.sis.wellspring.edu.vn/files/app-update-wis.json`. Thư mục `/files/` là
public (khác `/private/files` cần Bearer token). Upload trùng tên qua giao diện Frappe
có thể sinh ra `app-update-wis-1.json` — nên đặt thẳng vào thư mục và ghi đè.

Từ đó về sau, đổi chính sách = sửa nội dung file đó rồi lưu. Bản trong repo chỉ là bản
mẫu để đối chiếu, app **không** đọc file trong repo.

Không dựng file cũng không sao: app vẫn chạy như cũ (hỏi backend + store, mặc định chỉ
nhắc). File chỉ là cái công tắc.

## Test trước khi phát hành

```bash
# .env của máy dev
EXPO_PUBLIC_APP_UPDATE_CHECK_IN_DEV=true
EXPO_PUBLIC_APP_UPDATE_CONFIG_URL=https://admin.sis.wellspring.edu.vn/files/app-update-wis.json
```

Đặt `minimumVersion` cao hơn `version` trong `app.json` để popup bắt buộc hiện lên,
rồi đổi `force`/`enabled` và mở lại app để xem chính sách đổi theo. Kiểm tra chéo:

```bash
curl -s "https://prod.sis.wellspring.edu.vn/api/method/erp.api.erp_sis.app_version.get_latest_version?app_id=wis_staff&platform=ios"
curl -s https://prod.sis.wellspring.edu.vn/files/app-update-wis.json
```

## Bao lâu thì ăn?

- App kiểm tra 3,5 giây sau khi mở và mỗi lần quay lại tiền cảnh nếu kết quả cũ hơn
  1 tiếng (`UPDATE_STALE_TIME_MS` trong `src/hooks/useAppUpdate.ts`).
- Cache chỉ sống theo vòng đời process → mở lạnh app là đọc lại chính sách mới ngay.
- Request luôn kèm `?t=<timestamp>` và `Cache-Control: no-cache`.

## Đưa thay đổi này tới máy đang cài

Khác app phụ huynh, app GV **có `expo-updates`** (channel `production`), nên thay đổi
thuần JS như thế này đẩy được qua OTA, không cần chờ duyệt store:

```bash
eas update --channel production --message "remote config cập nhật"
```

Ràng buộc: OTA chỉ tới được máy có `runtimeVersion` **trùng khớp**. `app.json` đang
pin `runtimeVersion: "1.5.42"` còn App Store đang ở **1.5.41**, nên bản update đẩy từ
cây code hiện tại sẽ không tới ai cho tới khi 1.5.42 lên store. Muốn tới thẳng người
đang dùng 1.5.41 thì phải publish một bản update khai `runtimeVersion` là `1.5.41` —
chỉ làm được vì thay đổi này thuần JS, không thêm native module nào. Nếu có bất kỳ
thay đổi native nào đi kèm thì bắt buộc phải qua store.
