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

export function useChatAttachmentDownload() {
  const { t } = useLanguage();
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  const download = useCallback(
    async (attachment: DownloadableChatAttachment) => {
      const url = resolveChatAttachmentUrl(attachment.url);
      if (!url) return;
      try {
        setDownloadingUrl(attachment.url);
        const file = targetFile(safeChatAttachmentFileName(attachment.name), Date.now());
        const result = await FileSystem.File.downloadFileAsync(url, file, {
          idempotent: true,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(result.uri, {
            mimeType: attachment.mimeType || undefined,
            dialogTitle: attachment.name || undefined,
            UTI: attachment.mimeType || undefined,
          });
          return;
        }
        await Linking.openURL(result.uri);
      } catch (error) {
        console.error('[ExchangeChat] download attachment', error);
        // Tải/chia sẻ lỗi thì vẫn để người dùng xem được tệp — chỉ mất tên gốc.
        Alert.alert(
          t('exchange.attachment_download_error_title'),
          t('exchange.attachment_download_error'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('exchange.attachment_open_in_browser'), onPress: () => void Linking.openURL(url) },
          ],
        );
      } finally {
        setDownloadingUrl(null);
      }
    },
    [t],
  );

  return { downloadingUrl, download };
}

export default useChatAttachmentDownload;
