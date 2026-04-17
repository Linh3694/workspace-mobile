/**
 * Khối hiển thị lịch sử trao đổi phụ huynh khi CRM Issue có Feedback liên kết (source_feedback).
 */
import React, { useState } from 'react';
import { View, Text, Image, Modal } from 'react-native';
import { TouchableOpacity } from '../../../components/Common';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useTranslation } from 'react-i18next';
import { BASE_URL } from '../../../config/constants';
import { formatIssuePersonDisplayName } from '../../../utils/nameUtils';
import type { LinkedFeedbackPayload } from '../../../types/crmIssue';

type Props = {
  data: LinkedFeedbackPayload | null;
  loading?: boolean;
};

/**
 * Hiển thị lịch sử trao đổi với phụ huynh (Feedback liên kết) — tương tự FeedbackProcessing.
 */
export const LinkedFeedbackConversation: React.FC<Props> = ({ data, loading }) => {
  const { t } = useTranslation();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  if (!data?.source_feedback) {
    return null;
  }

  const replies = (data.replies || []).filter((r) => !r.is_internal);

  return (
    <View className="mb-4">
      <Text className="mb-3 text-lg font-semibold text-[#002855]">
        {t('crm_issue.parent_conversation_section')}
      </Text>

      {loading ? (
        <Text className="py-2 text-center text-sm text-gray-400">...</Text>
      ) : replies.length === 0 ? (
        <View className="rounded-2xl bg-[#F8F8F8] p-4">
          <Text className="text-center text-sm italic text-gray-400">
            {t('crm_issue.no_parent_replies')}
          </Text>
        </View>
      ) : (
        replies.map((reply, index) => {
          const isStaff = reply.reply_by_type === 'Staff';
          const staffName = formatIssuePersonDisplayName({
            fullName: reply.reply_by_full_name,
            userId: reply.reply_by,
          });
          const guardianName =
            reply.reply_by_full_name || data.guardian_info?.name || 'Phụ huynh';

          return (
            <View
              key={`fb-reply-${index}`}
              className="mb-3 rounded-2xl bg-white p-4"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
                elevation: 2,
              }}>
              <View className="mb-2 flex-row items-center">
                {isStaff ? (
                  <Text className="text-base font-bold text-[#2E7D32]">{staffName}</Text>
                ) : (
                  <Text className="text-base font-bold text-[#E53935]">
                    Phụ huynh {guardianName}
                  </Text>
                )}
              </View>

              {(() => {
                const parts = (reply.content || '').split('\n\n---\n');
                const textContent = parts[0]?.trim();
                const fileUrlRegex = /href="([^"]+)"/g;
                const attachmentUrls: string[] = [];
                let match;
                while ((match = fileUrlRegex.exec(reply.content || '')) !== null) {
                  attachmentUrls.push(match[1]);
                }

                return (
                  <>
                    {textContent ? (
                      <Text className="mb-2 text-base leading-6 text-gray-700">{textContent}</Text>
                    ) : null}
                    {attachmentUrls.length > 0 ? (
                      <View className="mt-2 flex-row flex-wrap gap-2">
                        {attachmentUrls.map((url, fileIndex) => {
                          const fullUrl = url.startsWith('http')
                            ? url
                            : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                          const isVideo = /\.(mp4|mov|avi|webm)$/i.test(url);

                          if (isImage) {
                            return (
                              <TouchableOpacity
                                key={fileIndex}
                                onPress={() => setPreviewImage(fullUrl)}
                                className="h-20 w-20 overflow-hidden rounded-lg">
                                <Image
                                  source={{ uri: fullUrl }}
                                  className="h-full w-full"
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            );
                          }
                          if (isVideo) {
                            return (
                              <TouchableOpacity
                                key={fileIndex}
                                onPress={() => setPreviewVideo(fullUrl)}
                                className="h-20 w-20 items-center justify-center rounded-lg bg-gray-800">
                                <Ionicons name="play-circle" size={32} color="white" />
                                <Text className="mt-1 text-xs text-white">Video</Text>
                              </TouchableOpacity>
                            );
                          }
                          return (
                            <View
                              key={fileIndex}
                              className="flex-row items-center rounded-lg bg-gray-100 px-2 py-1">
                              <Ionicons name="document" size={16} color="#666" />
                              <Text className="ml-1 text-xs text-gray-600" numberOfLines={1}>
                                {url.split('/').pop()}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </>
                );
              })()}

              <Text className="mt-2 text-sm text-gray-400">
                {reply.reply_date
                  ? new Date(reply.reply_date).toLocaleString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </Text>
            </View>
          );
        })
      )}

      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}>
        <View className="flex-1 items-center justify-center bg-black/80">
          <TouchableOpacity
            onPress={() => setPreviewImage(null)}
            style={{
              position: 'absolute',
              top: 50,
              right: 20,
              zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 20,
              padding: 8,
            }}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          {previewImage ? (
            <Image
              source={{ uri: previewImage }}
              style={{ width: '90%', height: '70%' }}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={!!previewVideo}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVideo(null)}>
        <View className="flex-1 items-center justify-center bg-black">
          <TouchableOpacity
            onPress={() => setPreviewVideo(null)}
            style={{
              position: 'absolute',
              top: 50,
              right: 20,
              zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 20,
              padding: 8,
            }}>
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          {previewVideo ? (
            <Video
              source={{ uri: previewVideo }}
              style={{ width: '100%', height: '70%' } as any}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
};
