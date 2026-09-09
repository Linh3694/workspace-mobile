#!/usr/bin/env bash
# Build iOS + Android NGAY TRÊN MÁY (eas build --local) rồi submit lên App Store / Google Play.
# Không tốn credit EAS cloud. Credentials + buildNumber/versionCode vẫn lấy từ EAS (appVersionSource: remote).
#
# Cách dùng:
#   ./scripts/release-local.sh                 # bump patch → build song song iOS+Android → submit cả hai
#   ./scripts/release-local.sh --no-submit     # chỉ build, file ra ở build/local/
#   ./scripts/release-local.sh --only ios      # chỉ 1 nền tảng (ios|android)
#   ./scripts/release-local.sh --no-bump       # build lại version hiện tại (vd: 1 nền tảng lỗi lần trước)
#   ./scripts/release-local.sh --submit-only   # chỉ submit file mới nhất trong build/local/
#   ./scripts/release-local.sh --sequential    # build lần lượt thay vì song song
#
# Yêu cầu 1 lần: ./scripts/setup-local-build.sh

set -u
cd "$(dirname "$0")/.."
source ./scripts/local-env.sh

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

# ===== Cấu hình theo repo =====
APP_SLUG="wis-admin"
INFO_PLIST="./ios/Wis/Info.plist"
EXPO_PLIST="./ios/Wis/Supporting/Expo.plist"
GRADLE="./android/app/build.gradle"
STRINGS_XML="./android/app/src/main/res/values/strings.xml"
COMMIT_PREFIX="chore"
PROFILE="production"
OUT_DIR="./build/local"
LOG_DIR="$OUT_DIR/logs"
# ==============================

NO_SUBMIT=false; NO_BUMP=false; SUBMIT_ONLY=false; SEQUENTIAL=false; ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --no-submit) NO_SUBMIT=true ;;
    --no-bump) NO_BUMP=true ;;
    --submit-only) SUBMIT_ONLY=true; NO_BUMP=true ;;
    --sequential) SEQUENTIAL=true ;;
    --only) shift; ONLY="$1" ;;
    *) echo -e "${RED}Tham số lạ: $1${NC}"; exit 1 ;;
  esac
  shift
done
DO_IOS=true; DO_ANDROID=true
[ "$ONLY" = "ios" ] && DO_ANDROID=false
[ "$ONLY" = "android" ] && DO_IOS=false

mkdir -p "$OUT_DIR" "$LOG_DIR"

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   📱 Local release ($APP_SLUG)${NC}"
echo -e "${CYAN}========================================${NC}"

# ---- Preflight ----
preflight() {
  local ok=true
  for t in eas node git; do command -v $t >/dev/null || { echo -e "${RED}Thiếu $t${NC}"; ok=false; }; done
  if $DO_IOS; then
    for t in xcodebuild fastlane pod; do command -v $t >/dev/null || { echo -e "${RED}Thiếu $t (iOS)${NC}"; ok=false; }; done
  fi
  if $DO_ANDROID; then
    [ -d "$ANDROID_HOME/platforms" ] || { echo -e "${RED}Thiếu Android SDK tại $ANDROID_HOME${NC}"; ok=false; }
    java -version 2>&1 | grep -q '"17\.' || { echo -e "${RED}JAVA_HOME phải là JDK 17 (hiện: $(java -version 2>&1 | head -1))${NC}"; ok=false; }
    [ -f ./google-services.json ] || { echo -e "${RED}Thiếu google-services.json${NC}"; ok=false; }
  fi
  $ok || { echo -e "${YELLOW}Chạy ./scripts/setup-local-build.sh trước.${NC}"; exit 1; }
  if [ -n "$(git status --porcelain)" ] && [ "$SUBMIT_ONLY" = false ]; then
    echo -e "${RED}Cây git chưa sạch. eas build --local đóng gói từ git nên thay đổi chưa commit sẽ KHÔNG vào build.${NC}"
    git status --short
    exit 1
  fi
  eas whoami >/dev/null 2>&1 || { echo -e "${RED}Chưa đăng nhập EAS: eas login${NC}"; exit 1; }
}
preflight

# ---- Version ----
CURRENT_VERSION=$(node -p "require('./app.json').expo.version")
OLD_VERSION=$CURRENT_VERSION

set_version() {
  local v="$1"
  node -e "
    const fs=require('fs'); const a=JSON.parse(fs.readFileSync('./app.json','utf8'));
    a.expo.version='$v'; a.expo.runtimeVersion='$v';
    fs.writeFileSync('./app.json', JSON.stringify(a,null,2)+'\n');
    const p=JSON.parse(fs.readFileSync('./package.json','utf8')); p.version='$v';
    fs.writeFileSync('./package.json', JSON.stringify(p,null,2)+'\n');
    if (fs.existsSync('./package-lock.json')) { const l=JSON.parse(fs.readFileSync('./package-lock.json','utf8')); l.version='$v'; if (l.packages && l.packages['']) l.packages[''].version='$v'; fs.writeFileSync('./package-lock.json', JSON.stringify(l,null,2)+'\n'); }"
  [ -f "$INFO_PLIST" ] && /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $v" "$INFO_PLIST"
  [ -f "$EXPO_PLIST" ] && /usr/libexec/PlistBuddy -c "Set :EXUpdatesRuntimeVersion $v" "$EXPO_PLIST" 2>/dev/null
  [ -f "$GRADLE" ] && sed -i '' "s/versionName \".*\"/versionName \"$v\"/" "$GRADLE"
  [ -f "$STRINGS_XML" ] && sed -i '' "s|<string name=\"expo_runtime_version\">.*</string>|<string name=\"expo_runtime_version\">$v</string>|" "$STRINGS_XML"
}
stage_version_files() {
  git add app.json package.json
  [ -f package-lock.json ] && git add package-lock.json
  for f in "$INFO_PLIST" "$EXPO_PLIST" "$GRADLE" "$STRINGS_XML"; do
    [ -f "$f" ] && ! git check-ignore -q "$f" && git add "$f"
  done
  return 0
}

if [ "$NO_BUMP" = true ]; then
  NEW_VERSION=$CURRENT_VERSION
  echo -e "${YELLOW}Giữ version: ${NEW_VERSION}${NC}"
else
  IFS='.' read -r MAJ MIN PAT <<< "$CURRENT_VERSION"
  NEW_VERSION="${MAJ}.${MIN}.$((PAT + 1))"
  echo -e "${GREEN}Version mới (iOS = Android): ${NEW_VERSION}${NC}"
  set_version "$NEW_VERSION"
  stage_version_files
  git commit -q -m "${COMMIT_PREFIX}: bump version to ${NEW_VERSION} [ios + android] (local build)" \
    && echo -e "${GREEN}✅ Đã commit bump${NC}"
fi

rollback_version() {
  [ "$NO_BUMP" = true ] && return 0
  echo -e "${RED}🔄 Hoàn version về ${OLD_VERSION}${NC}"
  set_version "$OLD_VERSION"
  stage_version_files
  git commit -q --amend -m "${COMMIT_PREFIX}: bump version to ${OLD_VERSION} (reverted, local build failed)" --no-edit || true
}

IPA="$OUT_DIR/${APP_SLUG}-${NEW_VERSION}.ipa"
AAB="$OUT_DIR/${APP_SLUG}-${NEW_VERSION}.aab"

# ---- Build ----
build_platform() {  # $1 = ios|android, $2 = output
  local p="$1" out="$2" log="$LOG_DIR/${1}-${NEW_VERSION}.log"
  echo -e "${BLUE}🔨 [$p] eas build --local → $out (log: $log)${NC}"
  [ "$p" = android ] && cp ./google-services.json ./android/app/google-services.json 2>/dev/null
  if eas build --platform "$p" --profile "$PROFILE" --local --non-interactive --output "$out" >"$log" 2>&1; then
    echo -e "${GREEN}✅ [$p] build xong: $out${NC}"; return 0
  else
    echo -e "${RED}❌ [$p] build lỗi. 60 dòng cuối log:${NC}"; tail -60 "$log"; return 1
  fi
}

IOS_OK=true; ANDROID_OK=true
if [ "$SUBMIT_ONLY" = false ]; then
  START=$(date +%s)
  if [ "$SEQUENTIAL" = true ]; then
    $DO_IOS && { build_platform ios "$IPA" || IOS_OK=false; }
    $DO_ANDROID && { build_platform android "$AAB" || ANDROID_OK=false; }
  else
    PIDS=()
    if $DO_IOS; then build_platform ios "$IPA" & PID_IOS=$!; fi
    if $DO_ANDROID; then build_platform android "$AAB" & PID_AND=$!; fi
    $DO_IOS && { wait "$PID_IOS" || IOS_OK=false; }
    $DO_ANDROID && { wait "$PID_AND" || ANDROID_OK=false; }
  fi
  echo -e "${CYAN}⏱  Build mất $(( ($(date +%s) - START) / 60 )) phút${NC}"

  if { $DO_IOS && ! $IOS_OK; } || { $DO_ANDROID && ! $ANDROID_OK; }; then
    if { ! $DO_IOS || ! $IOS_OK; } && { ! $DO_ANDROID || ! $ANDROID_OK; }; then
      rollback_version
    else
      echo -e "${YELLOW}⚠️  Một nền tảng lỗi, giữ version ${NEW_VERSION}. Build lại nền tảng lỗi bằng:${NC}"
      $IOS_OK || echo "   ./scripts/release-local.sh --no-bump --only ios"
      $ANDROID_OK || echo "   ./scripts/release-local.sh --no-bump --only android"
    fi
    exit 1
  fi
fi

[ "$NO_SUBMIT" = true ] && { echo -e "${GREEN}✅ Build xong (không submit). File ở $OUT_DIR${NC}"; exit 0; }

# ---- Submit ----
submit_platform() {  # $1 = ios|android, $2 = file
  [ -f "$2" ] || { echo -e "${RED}Không thấy $2${NC}"; return 1; }
  echo -e "${BLUE}📤 [$1] eas submit --path $2${NC}"
  eas submit --platform "$1" --profile "$PROFILE" --path "$2" --non-interactive
}
SUBMIT_FAIL=false
$DO_IOS && { submit_platform ios "$IPA" || SUBMIT_FAIL=true; }
$DO_ANDROID && { submit_platform android "$AAB" || SUBMIT_FAIL=true; }
$SUBMIT_FAIL && { echo -e "${RED}❌ Submit lỗi (build đã xong, version giữ nguyên). Thử lại: ./scripts/release-local.sh --submit-only${NC}"; exit 1; }

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   ✅ Đã build local + submit: ${NEW_VERSION}${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "${YELLOW}💡 Đừng quên: git push${NC}"
