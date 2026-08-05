/**
 * Tải tệp đính kèm chat Trao đổi về máy và GIỮ TÊN GỐC.
 *
 * URL của CDN chỉ mang hash nội dung ("6e1246314daf….xlsx") nên `Linking.openURL`
 * làm người dùng lưu ra một tệp tên vô nghĩa. Tên đúng nằm ở `attachment.name`
 * trong DB, nên phải tải về thư mục tạm với đúng tên đó rồi mở bảng chia sẻ.
 *
 * Chống trùng bằng THƯ MỤC tạm riêng mỗi lượt tải, không bằng cách bẻ tên file.
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { useLanguage } from '../../../hooks/useLanguage';
import { resolveChatAttachmentUrl } from '../../../services/chatService';

/** Đủ dùng cho cả `ChatAttachment` và `DatedAttachment`. */
export type DownloadableChatAttachment = {
  url: string;
  name?: string;
  mimeType?: string;
};

/**
 * Tên file an toàn để lưu xuống máy, GIỮ NGUYÊN dấu tiếng Việt: chỉ loại ký tự
 * điều khiển và ký tự hệ điều hành không cho phép. Danh sách trắng kiểu `\w` sẽ
 * biến "PR, PO - mẫu mới (3).xlsx" thành "PR_ PO - m_u m_i (3).xlsx".
 */
export function safeChatAttachmentFileName(name?: string): string {
  const cleaned = String(name || '')
    .trim()
    .replace(/\p{Cc}/gu, '')
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  return cleaned.slice(0, 160) || 'chat-attachment';
}

function targetFile(name: string, seq: number) {
  const dir = new FileSystem.Directory(FileSystem.Paths.cache, `chat-${seq}`);
  try {
    dir.create({ intermediates: true, idempotent: true });
    return new FileSystem.File(dir, name);
  } catch {
    // Không tạo được thư mục (quota/quyền) ⇒ vẫn phải tải được.
    return new FileSystem.File(FileSystem.Paths.cache, `${seq}-${name}`);
  }
}

type FileViewerModule = {
  default: {
    open: (
      path: string,
      options?: { displayName?: string; showOpenWithDialog?: boolean }
    ) => Promise<void>;
  };
};

/**
 * Mở tệp bằng viewer native NGAY TRONG APP (iOS: QuickLook, Android: intent chooser).
 * false nếu không mở được (Expo Go chưa có native module, máy không có app đọc
 * định dạng này, …) — nơi gọi rơi xuống bảng chia sẻ như luồng cũ.
 *
 * Không import tĩnh `react-native-file-viewer`: trên Expo Go module throw ngay khi
 * load, kéo sập cả màn chat.
 */
async function tryOpenWithNativeViewer(uri: string, displayName?: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FileViewer = (require('react-native-file-viewer') as FileViewerModule).default;
    // FileViewer nhận path thuần, không nhận scheme file://
    const path = uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
    await FileViewer.open(path, { displayName, showOpenWithDialog: true });
    return true;
  } catch (error) {
    console.warn('[ExchangeChat] native file viewer fallback', error);
    return false;
  }
}

export function useChatAttachmentDownload() {
  const { t } = useLanguage();
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  /** Tải về cache (giữ tên gốc) rồi trả uri local — dùng chung cho "xem" và "tải/chia sẻ". */
  const fetchToCache = useCallback(async (attachment: DownloadableChatAttachment, url: string) => {
    const file = targetFile(safeChatAttachmentFileName(attachment.name), Date.now());
    const result = await FileSystem.File.downloadFileAsync(url, file, {
      idempotent: true,
    });
    return result.uri;
  }, []);

  /** Bảng chia sẻ hệ thống — luồng "tải về/chia sẻ", cũng là fallback của viewer. */
  const shareLocalFile = useCallback(async (attachment: DownloadableChatAttachment, localUri: string) => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(localUri, {
        mimeType: attachment.mimeType || undefined,
        dialogTitle: attachment.name || undefined,
        UTI: attachment.mimeType || undefined,
      });
      return;
    }
    await Linking.openURL(localUri);
  }, []);

  /** Tải/chia sẻ lỗi thì vẫn để người dùng xem được tệp — chỉ mất tên gốc. */
  const alertFailure = useCallback(
    (url: string) => {
      Alert.alert(
        t('exchange.attachment_download_error_title'),
        t('exchange.attachment_download_error'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('exchange.attachment_open_in_browser'),
            onPress: () => void Linking.openURL(url),
          },
        ]
      );
    },
    [t]
  );

  const download = useCallback(
    async (attachment: DownloadableChatAttachment) => {
      const url = resolveChatAttachmentUrl(attachment.url);
      if (!url) return;
      try {
        setDownloadingUrl(attachment.url);
        const localUri = await fetchToCache(attachment, url);
        await shareLocalFile(attachment, localUri);
      } catch (error) {
        console.error('[ExchangeChat] download attachment', error);
        alertFailure(url);
      } finally {
        setDownloadingUrl(null);
      }
    },
    [alertFailure, fetchToCache, shareLocalFile]
  );

  /**
   * Xem tệp NGAY TRONG APP: tải về cache rồi mở QuickLook (iOS) / intent (Android).
   * Viewer không mở được (Expo Go, định dạng lạ…) → rơi xuống bảng chia sẻ như cũ.
   */
  const view = useCallback(
    async (attachment: DownloadableChatAttachment) => {
      const url = resolveChatAttachmentUrl(attachment.url);
      if (!url) return;
      try {
        setDownloadingUrl(attachment.url);
        const localUri = await fetchToCache(attachment, url);
        if (await tryOpenWithNativeViewer(localUri, attachment.name || undefined)) return;
        await shareLocalFile(attachment, localUri);
      } catch (error) {
        console.error('[ExchangeChat] view attachment', error);
        alertFailure(url);
      } finally {
        setDownloadingUrl(null);
      }
    },
    [alertFailure, fetchToCache, shareLocalFile]
  );

  return { downloadingUrl, download, view };
}

export default useChatAttachmentDownload;
