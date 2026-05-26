/**
 * Script tạo app icons cho iOS và Android từ icon gốc
 * Chạy: node scripts/generate-app-icons.js (Android mipmap + splash + iOS App Icon)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Đường dẫn icon gốc mặc định (đồng bộ với app.json expo.icon)
const SOURCE_ICON = path.join(__dirname, '../src/assets/icon.png');

// Cấu hình output cho Android
const ANDROID_ICONS = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

// Cấu hình output cho iOS
const IOS_ICON_SIZE = 1024;

// Thư mục output
const ANDROID_RES_PATH = path.join(__dirname, '../android/app/src/main/res');
const IOS_ASSETS_PATH = path.join(__dirname, '../ios/Wis/Images.xcassets/AppIcon.appiconset');

// Kích thước splash Android 12+ (windowSplashScreenAnimatedIcon) — khớp expo prebuild
const ANDROID_SPLASH_LOGOS = [
  { folder: 'drawable-mdpi', size: 288 },
  { folder: 'drawable-hdpi', size: 432 },
  { folder: 'drawable-xhdpi', size: 576 },
  { folder: 'drawable-xxhdpi', size: 864 },
  { folder: 'drawable-xxxhdpi', size: 1152 },
];

// Đồng bộ adaptiveIcon.backgroundColor + app.json expo.splash.backgroundColor
const SPLASH_BG = { r: 255, g: 252, b: 245, alpha: 1 };

/**
 * Tạo splashscreen_logo.png đúng logo (đã có repo dùng nhầm file template adaptive grid).
 * Logo scale ~52% cạnh canvas để vừa vòng masked splash, tránh nhìn như bị zoom/cắt.
 */
async function generateAndroidSplashLogos() {
  console.log('🌊 Đang tạo Android splashscreen_logo (các drawable-*dpi)...\n');

  for (const { folder, size } of ANDROID_SPLASH_LOGOS) {
    const outDir = path.join(ANDROID_RES_PATH, folder);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const logoMax = Math.round(size * 0.52);
    const resized = await sharp(SOURCE_ICON)
      .resize(logoMax, logoMax, { fit: 'inside' })
      .toBuffer({ resolveWithObject: false });
    const meta = await sharp(resized).metadata();
    const w = meta.width ?? logoMax;
    const h = meta.height ?? logoMax;
    const left = Math.round((size - w) / 2);
    const top = Math.round((size - h) / 2);
    const outPath = path.join(outDir, 'splashscreen_logo.png');

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: SPLASH_BG,
      },
    })
      .composite([{ input: resized, left, top }])
      .png()
      .toFile(outPath);

    console.log(`  ✅ ${folder}/splashscreen_logo.png (${size}x${size})`);
  }

  console.log('\n✅ Splash Android đã được tạo!\n');
}

async function generateAndroidIcons() {
  console.log('🤖 Đang tạo Android icons...\n');

  for (const config of ANDROID_ICONS) {
    const outputDir = path.join(ANDROID_RES_PATH, config.folder);

    // Tạo ic_launcher.webp
    const launcherPath = path.join(outputDir, 'ic_launcher.webp');
    await sharp(SOURCE_ICON)
      .resize(config.size, config.size)
      .webp({ quality: 100 })
      .toFile(launcherPath);
    console.log(`  ✅ ${config.folder}/ic_launcher.webp (${config.size}x${config.size})`);

    // Tạo ic_launcher_round.webp (bo tròn)
    const roundPath = path.join(outputDir, 'ic_launcher_round.webp');
    const roundMask = Buffer.from(
      `<svg><circle cx="${config.size / 2}" cy="${config.size / 2}" r="${config.size / 2}" fill="white"/></svg>`
    );
    await sharp(SOURCE_ICON)
      .resize(config.size, config.size)
      .composite([{ input: roundMask, blend: 'dest-in' }])
      .webp({ quality: 100 })
      .toFile(roundPath);
    console.log(`  ✅ ${config.folder}/ic_launcher_round.webp (${config.size}x${config.size})`);

    // Tạo ic_launcher_foreground.webp (với padding cho adaptive icon)
    const foregroundPath = path.join(outputDir, 'ic_launcher_foreground.webp');
    const foregroundSize = Math.round(config.size * 1.5); // Foreground cần lớn hơn để có safe zone
    const iconSize = Math.round(config.size * 0.7); // Icon chiếm ~70% để có padding
    const padding = Math.round((foregroundSize - iconSize) / 2);

    await sharp({
      create: {
        width: foregroundSize,
        height: foregroundSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{
        input: await sharp(SOURCE_ICON).resize(iconSize, iconSize).toBuffer(),
        left: padding,
        top: padding
      }])
      .resize(config.size, config.size) // Resize về đúng size
      .webp({ quality: 100 })
      .toFile(foregroundPath);
    console.log(`  ✅ ${config.folder}/ic_launcher_foreground.webp (${config.size}x${config.size})`);
  }

  console.log('\n✅ Android icons đã được tạo thành công!\n');
}

async function generateiOSIcon() {
  console.log('🍎 Đang tạo iOS icon...\n');

  const outputPath = path.join(IOS_ASSETS_PATH, 'App-Icon-1024x1024@1x.png');

  await sharp(SOURCE_ICON)
    .resize(IOS_ICON_SIZE, IOS_ICON_SIZE)
    .png()
    .toFile(outputPath);

  console.log(`  ✅ App-Icon-1024x1024@1x.png (${IOS_ICON_SIZE}x${IOS_ICON_SIZE})`);
  console.log('\n✅ iOS icon đã được tạo thành công!\n');
}

async function main() {
  console.log('\n📱 ========================================');
  console.log('   GENERATE APP ICONS (Android + iOS)');
  console.log('========================================\n');

  // Kiểm tra file nguồn
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error(`❌ Không tìm thấy file icon nguồn: ${SOURCE_ICON}`);
    process.exit(1);
  }

  console.log(`📁 Icon nguồn: ${SOURCE_ICON}\n`);

  try {
    await generateAndroidIcons();
    await generateAndroidSplashLogos();
    await generateiOSIcon();

    console.log('🎉 ========================================');
    console.log('   HOÀN THÀNH! Rebuild app để áp dụng.');
    console.log('========================================\n');
    console.log('Chạy lệnh sau để rebuild:');
    console.log('  - Android: npx expo run:android');
    console.log('  - iOS: npx expo run:ios\n');
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

main();

