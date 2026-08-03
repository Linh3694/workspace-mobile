/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
  // ─── GD2-02: chặn hardcode thương hiệu ngay trong IDE (PLAN-03 §3) ───
  //
  // Mức 'warn', KHÔNG phải 'error' — quyết định 03/08/2026.
  // Lý do: repo đã có sẵn 624 lỗi ESLint từ trước; bật 'error' làm rule này thêm
  // 1.100 lỗi nữa (tổng 1.724). Lint đỏ đặc như vậy thì không ai đọc, và nguy cơ
  // thật là dev tắt hẳn lint. Ở mức 'warn', IDE vẫn gạch vàng lúc gõ mà
  // `npm run lint` không bị chôn thêm.
  //
  // Lớp CHẶN thật là `npm run brand-lint` (mode=diff): chỉ soi dòng thêm mới,
  // chạy ~0,14s, nợ cũ không làm đỏ PR của người không gây ra nó.
  // Xem tools/brand-lint/README.md.
  //
  // SIẾT LẠI THÀNH 'error' sau khi GĐ3-A dọn xong hardcode trong src/
  // (PLAN-04 §1) — lúc đó số vi phạm còn lại đủ nhỏ để 'error' có nghĩa.
  {
    files: ['src/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'App.tsx'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Literal[value=/#(?:F05023|002855|D8421A|FEE8E0|E04420)/i]",
          message:
            'Không dùng mã màu thương hiệu trực tiếp. Dùng class `bg-brand`/`text-brand-secondary` hoặc `var(--brand-primary)`.',
        },
        {
          selector: "TemplateElement[value.raw=/#(?:F05023|002855)/i]",
          message: 'Không nhúng mã màu thương hiệu vào template string. Dùng biến CSS.',
        },
        {
          selector: "Literal[value=/wellspring/i]",
          message:
            'Không viết thẳng tên/domain trường. Dùng useSchoolInfo() hoặc biến môi trường.',
        },
      ],
    },
  },
  {
    // File dịch và file seed miễn trừ TẠM THỜI — gỡ sau GĐ3-B (PLAN-03 §2.2)
    files: ['src/locales/**', 'src/**/*.seed.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
