/**
 * Bong bóng tin thread Trao đổi — layout khớp MessageBubble GuardianChatScreen.
 */
import React, { memo, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import ReactionEmoji from '../../../components/Wislife/ReactionEmoji';
import type { ChatMessage } from '../../../types/chat';
import { parseChatWislifeStickerContent } from '../../../utils/chatWislifeSticker';
import { resolveChatReactionCode } from '../../../utils/emojiUtils';

import {
  CHAT_BUBBLE_MAX_WIDTH_RATIO,
  MY_MESSAGE_BUBBLE_BG,
  SWIPE_REPLY_MAX_DRAG_PX,
  SWIPE_REPLY_THRESHOLD_PX,
  chatAttachmentsKey,
  chatReactionsKey,
  formatChatTimeVi,
  type MessageThreadMeta,
} from '../exchangeChatThreadUtils';

import { ExchangeMessageAttachments } from './ExchangeMessageAttachments';
import type { MessageActionAnchor } from './MessageActionOverlay';

const CHAT_AVATAR_SIZE = 40;
const CHAT_AVATAR_COLUMN_WIDTH = CHAT_AVATAR_SIZE;

type Props = {
  message: ChatMessage;
  isMine: boolean;
  /** Viền teal khi nhảy tới tin ghim. */
  highlighted?: boolean;
  onReply: () => void;
  replyDisabled?: boolean;
  threadMeta: MessageThreadMeta;
  avatarUri: string;
  replyQuoteContent?: string;
  onOpenActionMenu?: (payload: { message: ChatMessage; anchor: MessageActionAnchor }) => void;
};

function ChatAvatarCircle({ uri }: { uri: string }) {
  const r = CHAT_AVATAR_SIZE / 2;
  return (
    <View
      style={{
        width: CHAT_AVATAR_SIZE,
        height: CHAT_AVATAR_SIZE,
        borderRadius: r,
        overflow: 'hidden',
        backgroundColor: '#E5E7EB',
      }}>
      <Image source={{ uri }} style={{ width: CHAT_AVATAR_SIZE, height: CHAT_AVATAR_SIZE }} resizeMode="cover" />
    </View>
  );
}

export const ExchangeMessageBubble = memo(
  function ExchangeMessageBubble({
    message,
    isMine,
    highlighted,
    onReply,
    replyDisabled,
    threadMeta,
    avatarUri,
    replyQuoteContent,
    onOpenActionMenu,
  }: Props) {
    const bubbleWrapRef = useRef<View>(null);
    const translateX = useRef(new Animated.Value(0)).current;
    const swipeReplyEnabled = Platform.OS !== 'web' && !(replyDisabled ?? false);
    const groupedNative = Platform.OS !== 'web';
    const { width: windowWidth } = useWindowDimensions();
    const bubbleMaxWidth = Math.round(windowWidth * CHAT_BUBBLE_MAX_WIDTH_RATIO);
    const recalled = Boolean(message.recalledAt);
    const longPressMenuEnabled = Boolean(onOpenActionMenu);

    useEffect(() => {
      translateX.setValue(0);
    }, [message._id, translateX]);

    const handleLongPress = () => {
      if (!onOpenActionMenu) return;
      Keyboard.dismiss();
      bubbleWrapRef.current?.measureInWindow((x, y, width, height) => {
        onOpenActionMenu({ message, anchor: { x, y, width, height } });
      });
    };

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponderCapture: (_, gs) => {
            if (!swipeReplyEnabled) return false;
            const absDx = Math.abs(gs.dx);
            const absDy = Math.abs(gs.dy);
            return absDx > 14 && absDx > absDy * 1.2;
          },
          onPanResponderMove: (_, gs) => {
            const raw = gs.dx;
            const clamped = Math.max(-SWIPE_REPLY_MAX_DRAG_PX, Math.min(SWIPE_REPLY_MAX_DRAG_PX, raw));
            translateX.setValue(clamped);
          },
          onPanResponderRelease: (_, gs) => {
            const dominantHorizontal =
              Math.abs(gs.dx) >= SWIPE_REPLY_THRESHOLD_PX &&
              Math.abs(gs.dx) > Math.abs(gs.dy) * 1.05;
            if (swipeReplyEnabled && dominantHorizontal) {
              onReply();
            }
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              friction: 7,
              tension: 120,
            }).start();
          },
          onPanResponderTerminate: () => {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              friction: 7,
              tension: 120,
            }).start();
          },
        }),
      [swipeReplyEnabled, onReply, translateX]
    );

    const rowMb = groupedNative ? (threadMeta.showTimestamp ? 'mb-3' : 'mb-1') : 'mb-3';
    const showSenderName = !isMine && (!groupedNative || threadMeta.showAvatar);
    const showTimestamp = !groupedNative || threadMeta.showTimestamp;

    const reactionUniq = useMemo(() => {
      const list = message.reactions || [];
      const seen = new Set<string>();
      const order: string[] = [];
      for (const r of list) {
        const k = String(r.emoji || '');
        if (!k || seen.has(k)) continue;
        seen.add(k);
        order.push(k);
      }
      return order.slice(0, 3);
    }, [message.reactions]);

    const reactionTotal = message.reactions?.length ?? 0;
    const hasReactions = reactionUniq.length > 0 || reactionTotal > 0;
    const bubbleAlign = isMine ? 'flex-end' : 'flex-start';

    const bubbleInner = (
      <View
        className={`rounded-xl px-4 pt-3 ${isMine ? '' : 'bg-gray-100'} ${hasReactions ? 'pb-7' : 'pb-3'}`}
        style={[
          {
            maxWidth: bubbleMaxWidth,
            alignSelf: bubbleAlign,
          },
          isMine ? { backgroundColor: MY_MESSAGE_BUBBLE_BG } : {},
        ]}>
        {showSenderName && (
          <Text className="mb-1 font-mulish-bold text-sm text-[#002855]">{message.senderSnapshot?.name}</Text>
        )}
        {message.replyTo && replyQuoteContent && !recalled ? (
          <View
            className={`mb-2 rounded-lg border-l-4 px-3 py-2 ${isMine ? 'border-white/70 bg-white/10' : 'border-[#F97316] bg-white'}`}>
            <Text className={`font-mulish-bold text-sm ${isMine ? 'text-white' : 'text-[#002855]'}`}>
              {message.replyTo.senderName}
            </Text>
            <Text
              numberOfLines={3}
              className={`font-mulish-medium text-sm ${isMine ? 'text-white/80' : 'text-gray-500'}`}>
              {replyQuoteContent}
            </Text>
          </View>
        ) : null}
        {recalled ? (
          <Text className={`font-mulish-medium text-base italic ${isMine ? 'text-white/85' : 'text-gray-500'}`}>
            Tin nhắn đã thu hồi
          </Text>
        ) : (
          <>
            {(message.attachments?.length ?? 0) > 0 ? (
              <ExchangeMessageAttachments attachments={message.attachments!} isMine={isMine} />
            ) : null}
            {(() => {
              const wl = parseChatWislifeStickerContent(message.content);
              if (wl) {
                return (
                  <View className="items-center py-1">
                    <ReactionEmoji code={resolveChatReactionCode(wl)} size={56} loop={false} autoPlay />
                  </View>
                );
              }
              if (message.content?.trim()) {
                return (
                  <Text className={`font-mulish-medium text-base ${isMine ? 'text-white' : 'text-gray-900'}`}>
                    {message.content}
                  </Text>
                );
              }
              return null;
            })()}
          </>
        )}
        {showTimestamp ? (
          <Text className={`mt-2 font-mulish-medium text-xs ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
            {formatChatTimeVi(message.createdAt)}
          </Text>
        ) : null}
      </View>
    );

    const bubbleShell = (
      <View
        ref={bubbleWrapRef}
        collapsable={false}
        style={{
          position: 'relative',
          maxWidth: bubbleMaxWidth,
          alignSelf: bubbleAlign,
        }}>
        {bubbleInner}
        {hasReactions ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              ...(isMine ? { left: 6 } : { right: 6 }),
              bottom: -8,
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 9999,
              backgroundColor: '#fff',
              paddingLeft: 5,
              paddingRight: reactionTotal > 1 ? 6 : 5,
              paddingVertical: 2,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.14,
              shadowRadius: 3,
              elevation: 3,
            }}>
            {reactionUniq.map((em, idx) => (
              <View key={em} style={{ marginLeft: idx > 0 ? 1 : 0, marginRight: 1 }}>
                <ReactionEmoji code={resolveChatReactionCode(em)} size={22} loop={false} autoPlay />
              </View>
            ))}
            {reactionTotal > 1 ? (
              <Text className="font-mulish-semibold text-[10px] text-gray-600">
                {reactionTotal > 99 ? '99+' : reactionTotal}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );

    const bubbleTouchable = longPressMenuEnabled ? (
      <Pressable onLongPress={handleLongPress} delayLongPress={420}>
        {bubbleShell}
      </Pressable>
    ) : (
      bubbleShell
    );

    const columnInner = (
      <View className={isMine ? 'items-end' : 'items-start'}>{bubbleTouchable}</View>
    );
    const column = highlighted ? (
      <View style={{ borderWidth: 2, borderColor: '#0d9488', borderRadius: 20, padding: 2 }}>
        {columnInner}
      </View>
    ) : (
      columnInner
    );

    if (!groupedNative) {
      return (
        <Animated.View
          className={`${rowMb} px-4 ${isMine ? 'items-end' : 'items-start'}`}
          style={{ transform: [{ translateX }] }}
          {...(swipeReplyEnabled ? panResponder.panHandlers : {})}>
          {column}
        </Animated.View>
      );
    }

    return (
      <Animated.View
        className={`${rowMb} flex-row px-4 ${isMine ? 'justify-end' : 'justify-start'}`}
        style={{ transform: [{ translateX }] }}
        {...(swipeReplyEnabled ? panResponder.panHandlers : {})}>
        {isMine ? (
          column
        ) : (
          <View className="flex-row items-start gap-2 self-start">
            <View style={{ width: CHAT_AVATAR_COLUMN_WIDTH }} className="shrink-0">
              {threadMeta.showAvatar ? <ChatAvatarCircle uri={avatarUri} /> : null}
            </View>
            {column}
          </View>
        )}
      </Animated.View>
    );
  },
  (prev, next) =>
    prev.message._id === next.message._id &&
    prev.message.content === next.message.content &&
    prev.message.createdAt === next.message.createdAt &&
    prev.message.recalledAt === next.message.recalledAt &&
    prev.highlighted === next.highlighted &&
    chatAttachmentsKey(prev.message.attachments) === chatAttachmentsKey(next.message.attachments) &&
    chatReactionsKey(prev.message.reactions) === chatReactionsKey(next.message.reactions) &&
    prev.isMine === next.isMine &&
    prev.replyDisabled === next.replyDisabled &&
    prev.threadMeta.showAvatar === next.threadMeta.showAvatar &&
    prev.threadMeta.showTimestamp === next.threadMeta.showTimestamp &&
    prev.avatarUri === next.avatarUri &&
    prev.replyQuoteContent === next.replyQuoteContent &&
    prev.onReply === next.onReply &&
    prev.onOpenActionMenu === next.onOpenActionMenu
);
