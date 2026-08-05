/**
 * Danh sách đầy đủ Ảnh & Video / Tệp của hội thoại — chia nhóm theo ngày gửi.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InlineToast, useInlineToast } from '../../components/Common';
import { ROUTES } from '../../constants/routes';
import { useLanguage } from '../../hooks/useLanguage';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import { chatService, resolveChatAttachmentUrl } from '../../services/chatService';
import { saveMediaToDevice } from '../../utils/mediaDownload';

import { ChatImagePreviewModal } from './components/ChatImagePreviewModal';
import { ChatVideoThumbnail } from './components/ChatVideoThumbnail';
import {
  collectDatedAttachments,
  groupAttachmentsByDay,
  type DatedAttachment,
} from './exchangeInfoUtils';
import { useChatAttachmentDownload } from './lib/chatAttachmentDownload';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, typeof ROUTES.SCREENS.EXCHANGE_CHAT_ATTACHMENTS>;

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ExchangeChatAttachmentsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { t } = useLanguage();
  const { width: windowWidth } = useWindowDimensions();

  const conversationId = String(route.params?.conversationId || '').trim();
  const kind = route.params?.kind ?? 'media';
  const headerTitle =
    route.params?.title || (kind === 'media' ? t('exchange.info_media') : t('exchange.info_files'));

  const [dated, setDated] = useState<DatedAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await chatService.getMessages(conversationId, 1, 50);
        if (!mounted) return;
        setDated(collectDatedAttachments(data.messages || []));
      } catch (e) {
        console.warn('[ExchangeChatAttachments] load failed', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [conversationId]);

  const groups = useMemo(() => {
    const filtered = dated.filter((a) =>
      kind === 'media' ? a.kind === 'image' || a.kind === 'video' : a.kind === 'file'
    );
    return groupAttachmentsByDay(filtered);
  }, [dated, kind]);

  /** Ảnh (theo thứ tự hiển thị các nhóm) — để lightbox vuốt qua lại. */
  const imagesOnly = useMemo(
    () => groups.flatMap((g) => g.items).filter((a) => a.kind === 'image'),
    [groups]
  );
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const { downloadingUrl, download, view } = useChatAttachmentDownload();

  /** Chỉ dùng cho video (xem ngoài app); tệp thì phải tải để giữ tên gốc. */
  const openAttachment = (url?: string) => {
    const u = resolveChatAttachmentUrl(url || '');
    if (u) void Linking.openURL(u).catch(() => undefined);
  };

  /** Bấm 1 media: ảnh → lightbox trong app; video → mở ngoài. */
  const onTapMedia = (att: DatedAttachment) => {
    if (att.kind === 'video') {
      openAttachment(att.url);
      return;
    }
    const i = imagesOnly.findIndex((x) => x.url === att.url);
    if (i >= 0) setPreviewIndex(i);
    else openAttachment(att.url);
  };

  /** Giữ 1 media (ảnh hoặc video) → tải về máy. */
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useInlineToast();
  const onLongPressMedia = async (att: DatedAttachment) => {
    const url = resolveChatAttachmentUrl(att.url);
    if (!url || savingUrl) return;
    try {
      setSavingUrl(att.url);
      const result = await saveMediaToDevice({
        url,
        name: att.name,
        mimeType: att.mimeType,
        kind: att.kind === 'video' ? 'video' : 'image',
      });
      if (result === 'saved-to-library') {
        showToast(att.kind === 'video' ? 'Đã lưu video vào album' : 'Đã lưu ảnh vào album');
      }
    } catch (error) {
      console.error('[ExchangeChatAttachments] save media', error);
      showToast('Không thể tải hoặc lưu tệp này', 'error');
    } finally {
      setSavingUrl(null);
    }
  };

  const mediaTile = Math.floor((windowWidth - 32 - 16) / 3); // px-4 (32) + 2 gaps (8*2)
  const isEmpty = !loading && groups.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="flex-row items-center border-b border-gray-100 px-2 py-2">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={26} color="#0A2240" />
        </TouchableOpacity>
        <Text className="flex-1 text-center text-lg font-bold text-[#0A2240]">{headerTitle}</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF7A00" />
        </View>
      ) : isEmpty ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons
            name={kind === 'media' ? 'images-outline' : 'document-outline'}
            size={48}
            color="#D1D5DB"
          />
          <Text className="mt-3 text-center text-sm text-[#9CA3AF]">
            {kind === 'media' ? t('exchange.info_no_media') : t('exchange.info_no_files')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          {groups.map((g) => (
            <View key={g.dayKey} className="mb-5">
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">
                {g.label}
              </Text>
              {kind === 'media' ? (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {g.items.map((a, i) => (
                    <Pressable
                      key={`${a.url}-${i}`}
                      onPress={() => onTapMedia(a)}
                      onLongPress={() => void onLongPressMedia(a)}
                      delayLongPress={420}
                      className="relative overflow-hidden rounded-lg bg-black/10"
                      style={{ width: mediaTile, height: mediaTile }}>
                      {a.kind === 'video' ? (
                        <ChatVideoThumbnail
                          uri={resolveChatAttachmentUrl(a.url)}
                          width={mediaTile}
                          height={mediaTile}
                          playIconSize={30}
                          dimmed={false}
                        />
                      ) : (
                        <Image
                          source={{ uri: resolveChatAttachmentUrl(a.url) }}
                          style={{ width: mediaTile, height: mediaTile }}
                          resizeMode="cover"
                        />
                      )}
                      {savingUrl === a.url ? (
                        <View
                          pointerEvents="none"
                          className="absolute inset-0 items-center justify-center bg-black/40">
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : (
                // Tap = xem in-app (tải về cache giữ TÊN GỐC rồi mở QuickLook/intent);
                // giữ = tải về / chia sẻ như cũ.
                g.items.map((f, i) => (
                  <TouchableOpacity
                    key={`${f.url}-${i}`}
                    onPress={() => void view(f)}
                    onLongPress={() => void download(f)}
                    delayLongPress={420}
                    disabled={downloadingUrl === f.url}
                    className="flex-row items-center gap-3 rounded-xl py-2">
                    <View
                      className="items-center justify-center rounded-lg"
                      style={{ width: 40, height: 40, backgroundColor: '#FEF2F2' }}>
                      {downloadingUrl === f.url ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <Ionicons name="document-text-outline" size={22} color="#EF4444" />
                      )}
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-semibold text-[#0A2240]" numberOfLines={1}>
                        {f.name || 'Tệp đính kèm'}
                      </Text>
                      {f.size != null ? (
                        <Text className="text-xs text-[#9CA3AF]">{formatFileSize(f.size)}</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                  </TouchableOpacity>
                ))
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {toast ? (
        <InlineToast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          floating
          onHide={hideToast}
        />
      ) : null}

      {previewIndex != null ? (
        <ChatImagePreviewModal
          images={imagesOnly}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}
