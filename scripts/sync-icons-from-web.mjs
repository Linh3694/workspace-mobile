/**
 * Đồng bộ bộ icon design-system từ web sang mobile.
 *
 *   node scripts/sync-icons-from-web.mjs
 *
 * Nguồn:  ../frappe-sis-frontend/public/icon-v2/*.svg
 * Đích:   src/assets/icon-v2/*.svg  +  src/components/ui-v2/level-0-atoms/media/iconRegistry.ts
 *
 * ─── Vì sao phải xử lý lại chứ không copy thẳng ───────────────────────────────
 *
 * Web tô màu icon bằng CSS `filter: brightness(0) saturate(100%) invert(…)`, tức
 * là **ép cả ảnh về một tông duy nhất** rồi xoay màu. RN không có filter đó.
 *
 * Cách tương đương trên RN: để `react-native-svg` nhận màu qua `currentColor`.
 * Vì kết quả trên web vốn đã đơn sắc, đổi MỌI fill/stroke (trừ `none`) thành
 * `currentColor` cho ra đúng hình ảnh web đang hiển thị — kể cả những chỗ file
 * gốc ghi `#757575` hay `#3F4246`, vì filter của web cũng nuốt hết chúng.
 *
 * `fill="none"` giữ nguyên: đó là nền trong suốt, không phải nét vẽ.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = join(ROOT, '..', 'frappe-sis-frontend', 'public', 'icon-v2');
const OUT_DIR = join(ROOT, 'src', 'assets', 'icon-v2');
const REGISTRY = join(ROOT, 'src', 'components', 'ui-v2', 'level-0-atoms', 'media', 'iconRegistry.ts');

if (!existsSync(SRC)) {
  console.error(`Không thấy thư mục nguồn: ${SRC}`);
  console.error('Cần có repo frappe-sis-frontend nằm cạnh workspace-mobile.');
  process.exit(1);
}

/** `Data Set - Iconly Pro.svg` → `data-set-pro`; phần còn lại vốn đã kebab-case. */
const toSlug = (file) =>
  file
    .replace(/\.svg$/i, '')
    .replace(/iconly pro/gi, 'pro')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/**
 * Tên biến hợp lệ trong TS: `chevron-down` → `ChevronDown`.
 * Thêm tiền tố `Icon` khi slug mở đầu bằng chữ số (`2-chat` → `Icon2Chat`) —
 * định danh JS không được bắt đầu bằng số.
 */
const toPascal = (slug) => {
  const pascal = slug.split('-').filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  return /^[0-9]/.test(pascal) ? `Icon${pascal}` : pascal;
};

/**
 * Đổi mọi màu cứng sang `currentColor`, giữ `none`.
 * Bỏ luôn width/height trên thẻ <svg> để prop `width`/`height` của callsite
 * thắng — nếu giữ lại, react-native-svg lấy giá trị trong file làm mặc định và
 * icon sẽ luôn 24px bất kể truyền size bao nhiêu.
 */
function normalize(svg) {
  return svg
    .replace(/(fill|stroke)="(?!none")[^"]*"/g, '$1="currentColor"')
    .replace(/<svg([^>]*?)\s(width|height)="[^"]*"/g, '<svg$1')
    .replace(/<svg([^>]*?)\s(width|height)="[^"]*"/g, '<svg$1');
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.svg')).sort();
const entries = [];
const collisions = new Map();

for (const file of files) {
  const slug = toSlug(file);
  if (collisions.has(slug)) {
    console.warn(`⚠️  trùng tên sau khi chuẩn hoá: "${file}" và "${collisions.get(slug)}" → cùng ra "${slug}". Bỏ qua file sau.`);
    continue;
  }
  collisions.set(slug, file);

  writeFileSync(join(OUT_DIR, `${slug}.svg`), normalize(readFileSync(join(SRC, file), 'utf8')));
  entries.push({ slug, ident: toPascal(slug) });
}

const imports = entries.map((e) => `import ${e.ident} from '../../../../assets/icon-v2/${e.slug}.svg';`).join('\n');
const mapRows = entries.map((e) => `  '${e.slug}': ${e.ident},`).join('\n');

writeFileSync(
  REGISTRY,
  `// ⚠️ FILE SINH TỰ ĐỘNG — đừng sửa tay.
// Chạy lại: node scripts/sync-icons-from-web.mjs
//
// Nguồn: frappe-sis-frontend/public/icon-v2 — cùng bộ icon với web, đã đổi màu
// cứng sang currentColor để tô được bằng prop \`color\` của react-native-svg.
import type React from 'react';
import type { SvgProps } from 'react-native-svg';

${imports}

/** Tên icon hợp lệ — gõ sai sẽ bị TypeScript bắt ngay tại callsite. */
export type IconV2Name =
${entries.map((e) => `  | '${e.slug}'`).join('\n')};

export const ICON_V2: Record<IconV2Name, React.FC<SvgProps>> = {
${mapRows}
};

export const ICON_V2_NAMES = Object.keys(ICON_V2) as IconV2Name[];
`
);

console.log(`✅ ${entries.length} icon → src/assets/icon-v2/`);
console.log(`✅ registry → ${REGISTRY.replace(ROOT + '/', '')}`);
