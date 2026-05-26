/**
 * Long-press tin nhắn: blur + highlight bubble + pill emoji + Trả lời / Sao chép / Thu hồi — khớp parent-portal MessageActionOverlay.
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RevokeIcon from '../../../assets/revoke.svg';
import ReactionEmoji from '../../../components/Wislife/ReactionEmoji';
import type { ChatEmoji, ChatMessage } from '../../../types/chat';
import { WISLIFE_EMOJIS } from '../../../utils/emojiUtils';

const GAP = 10;
const CARD_PAD_V = 24;
const EMOJI_PILL_H = 48;
const PILL_TO_ACTION_GAP = 6;
const ACTION_ROW_H = 148;
const EMOJI_PICKER_SIZE = 28;
/** Chiều ngang pill vừa 6 emoji một hàng (size + vùng bấm + padding viên thuốc). */
const EMOJI_PILL_INTRINSIC_WIDTH =
  WISLIFE_EMOJIS.length * (EMOJI_PICKER_SIZE + 12) + 20;

export type MessageActionAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  visible: boolean;
  anchor: MessageActionAnchor;
  message: ChatMessage;
  isMine: boolean;
  replyQuoteContent?: string;
  showSenderName: boolean;
  showTimestamp: boolean;
  locked: boolean;
  /** Hiện nút Thu hồi (tin của mình, chưa thu hồi, nhóm không locked). */
  showRecallButton: boolean;
  /** Còn trong khung 15 phút — nếu false vẫn hiện icon nhưng mờ / bấm báo hết hạn. */
  canRecall: boolean;
  bubbleMaxWidth: number;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onReact: (emoji: ChatEmoji) => void;
  onRecall: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  isPinned?: boolean;
};

const MY_BUBBLE_BG = '#0D9488';

export function MessageActionOverlay({
  visible,
  anchor,
  message,
  isMine,
  replyQuoteContent,
  showSenderName,
  showTimestamp,
  locked,
  showRecallButton,
  canRecall,
  bubbleMaxWidth,
  onClose,
  onReply,
  onCopy,
  onReact,
  onRecall,
  onPin,
  onUnpin,
  isPinned = false,
}: Props) {
  const { width: windowW, height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const backdropOp = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.94)).current;
  const cardY = useRef(new Animated.Value(8)).current;

  /** Một hàng: Trả lời + Sao chép + Thu hồi (nếu có). */
  const stackHeight = useMemo(() => {
    const actionOnly = CARD_PAD_V + ACTION_ROW_H;
    if (locked) return actionOnly;
    return EMOJI_PILL_H + PILL_TO_ACTION_GAP + actionOnly;
  }, [locked]);

  const flipUp = useMemo(() => {
    const bottomLimit = windowH - insets.bottom - 24;
    const anchorBottom = anchor.y + anchor.height;
    const needBelow = GAP + stackHeight + 24;
    const spaceBelow = bottomLimit - anchorBottom;
    const spaceAbove = anchor.y - insets.top;
    return spaceBelow < needBelow && spaceAbove > spaceBelow;
  }, [
    anchor.height,
    anchor.y,
    stackHeight,
    insets.bottom,
    insets.top,
    windowH,
  ]);

  /** Pill làm chuẩn: đủ 6 emoji một hàng; card action cùng width. */
  const menuStackWidth = Math.min(EMOJI_PILL_INTRINSIC_WIDTH, windowW - 24);
  const emojiPillWidth = menuStackWidth;
  const cardWidth = menuStackWidth;
  const cardLeft = Math.max(
    12,
    Math.min(
      anchor.x + anchor.width / 2 - cardWidth / 2,
      windowW - cardWidth - 12,
    ),
  );

  /** Bong bóng overlay: tối đa như trong thread (bubbleMaxWidth), không ép hẹp theo measure. */
  const highlightMaxW = bubbleMaxWidth + 8;
  const highlightW = Math.max(
    1,
    Math.min(
      highlightMaxW,
      isMine
        ? anchor.x + anchor.width - 12
        : windowW - 12 - anchor.x,
    ),
  );
  const highlightLeft = isMine
    ? Math.max(12, anchor.x + anchor.width - highlightW)
    : anchor.x;

  const stackTop = flipUp
    ? anchor.y - stackHeight - GAP
    : anchor.y + anchor.height + GAP;

  useEffect(() => {
    if (!visible) return;
    backdropOp.setValue(0);
    cardScale.setValue(0.94);
    cardY.setValue(8);
    Animated.parallel([
      Animated.timing(backdropOp, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 8,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(cardY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, backdropOp, cardScale, cardY]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const recalled = Boolean(message.recalledAt);

  const bubbleInner = (
    <View
      style={[
        styles.bubble,
        isMine ? { backgroundColor: MY_BUBBLE_BG } : { backgroundColor: '#F3F4F6' },
        { maxWidth: bubbleMaxWidth, alignSelf: isMine ? 'flex-end' : 'flex-start' },
      ]}>
      {showSenderName && !isMine ? (
        <Text className="mb-1 font-mulish-bold text-sm text-[#002855]">
          {message.senderSnapshot?.name}
        </Text>
      ) : null}
      {message.replyTo && replyQuoteContent && !recalled ? (
        <View
          className={`mb-2 rounded-lg border-l-4 px-3 py-2 ${isMine ? 'border-white/70 bg-white/10' : 'border-[#F97316] bg-white'}`}>
          <Text className={`font-mulish-bold text-sm ${isMine ? 'text-white' : 'text-[#002855]'}`}>
            {message.replyTo.senderName}
          </Text>
          <Text
            numberOfLines={1}
            className={`font-mulish-medium text-sm ${isMine ? 'text-white/80' : 'text-gray-500'}`}>
            {replyQuoteContent}
          </Text>
        </View>
      ) : null}
      {recalled ? (
        <Text
          className={`font-mulish-medium text-base italic ${isMine ? 'text-white/85' : 'text-gray-500'}`}>
          Tin nhắn đã thu hồi
        </Text>
      ) : (
        <Text className={`font-mulish-medium text-base ${isMine ? 'text-white' : 'text-gray-900'}`}>
          {message.content}
        </Text>
      )}
      {showTimestamp ? (
        <Text
          className={`mt-2 font-mulish-medium text-xs ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
          {message.createdAt
            ? new Date(message.createdAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent={Platform.OS === 'android'}
      onRequestClose={onClose}>
      <View className="flex-1">
        <Animated.View
          style={[styles.fill, { opacity: backdropOp }]}
          className="bg-[#0f172a]/55">
          <Pressable
            style={styles.fill}
            onPress={() => {
              Keyboard.dismiss();
              onClose();
            }}>
            {Platform.OS === 'web' ? null : (
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
            )}
          </Pressable>
        </Animated.View>

        {!visible ? null : (
          <>
            <View
              pointerEvents="none"
              style={[
                styles.highlightBubble,
                {
                  left: highlightLeft,
                  top: anchor.y,
                  width: highlightW,
                  minHeight: anchor.height,
                  alignItems: isMine ? 'flex-end' : 'flex-start',
                },
              ]}>
              {bubbleInner}
            </View>

            <Animated.View
              style={[
                styles.menuStack,
                {
                  top: Math.max(insets.top + 8, stackTop),
                  left: cardLeft,
                  width: cardWidth,
                  transform: [{ scale: cardScale }, { translateY: cardY }],
                },
              ]}>
              {!locked ? (
                <View style={[styles.emojiPill, { width: emojiPillWidth }]}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={styles.emojiPillScroll}
                    contentContainerStyle={styles.emojiPillScrollContent}>
                    {WISLIFE_EMOJIS.map((item, idx) => (
                      <Pressable
                        key={item.code}
                        onPress={() => {
                          Keyboard.dismiss();
                          onReact(item.code as ChatEmoji);
                        }}
                        style={[styles.emojiHit, idx > 0 ? { marginLeft: 2 } : null]}
                        className="items-center justify-center active:opacity-80">
                        <ReactionEmoji
                          code={item.code}
                          size={EMOJI_PICKER_SIZE}
                          loop
                          autoPlay
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              {!locked ? <View style={{ height: PILL_TO_ACTION_GAP }} /> : null}

              <View style={styles.actionCard}>
                {!locked ? (
                  <View className="flex-row flex-wrap items-center justify-center gap-1">
                    <ActionCell
                      icon="arrow-undo"
                      label="Trả lời"
                      color="#0D9488"
                      onPress={() => {
                        Keyboard.dismiss();
                        onReply();
                      }}
                    />
                    <ActionCell
                      icon="copy-outline"
                      label="Sao chép"
                      color="#1E40AF"
                      onPress={() => {
                        Keyboard.dismiss();
                        onCopy();
                      }}
                    />
                    {!message.recalledAt ? (
                      isPinned ? (
                        <ActionCell
                          icon="pin"
                          label="Bỏ ghim"
                          color="#0D9488"
                          onPress={() => {
                            Keyboard.dismiss();
                            onUnpin?.();
                          }}
                        />
                      ) : (
                        <ActionCell
                          icon="pin-outline"
                          label="Ghim"
                          color="#0D9488"
                          onPress={() => {
                            Keyboard.dismiss();
                            onPin?.();
                          }}
                        />
                      )
                    ) : null}
                    {showRecallButton ? (
                      <RecallActionCell recallAllowed={canRecall} onRecall={onRecall} />
                    ) : null}
                  </View>
                ) : (
                  <View className="flex-row flex-wrap items-center justify-center gap-1">
                    <ActionCell
                      icon="copy-outline"
                      label="Sao chép"
                      color="#1E40AF"
                      onPress={() => {
                        Keyboard.dismiss();
                        onCopy();
                      }}
                    />
                  </View>
                )}
              </View>
            </Animated.View>
          </>
        )}
      </View>
    </Modal>
  );
}

function ActionCell({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[68px] min-w-[72px] items-center justify-center px-2 py-2 active:opacity-75">
      <Ionicons name={icon} size={24} color={color} />
      <Text className="mt-1 text-center font-mulish-semibold text-sm text-[#002855]">{label}</Text>
    </Pressable>
  );
}

/** Nút Thu hồi: icon revoke.svg; hết hạn vẫn bấm được để hiện Alert. */
function RecallActionCell({
  recallAllowed,
  onRecall,
}: {
  recallAllowed: boolean;
  onRecall: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Keyboard.dismiss();
        if (!recallAllowed) {
          Alert.alert(
            'Thu hồi tin nhắn',
            'Tin nhắn đã quá hạn thu hồi (15 phút).',
            [{ text: 'Đóng', style: 'cancel' }],
          );
          return;
        }
        onRecall();
      }}
      className="min-h-[68px] min-w-[72px] items-center justify-center px-2 py-2 active:opacity-75"
      style={{ opacity: recallAllowed ? 1 : 0.45 }}>
      <RevokeIcon width={24} height={24} fill={recallAllowed ? '#F05023' : '#9CA3AF'} />
      <Text
        className={`mt-1 text-center font-mulish-semibold text-sm ${recallAllowed ? 'text-[#002855]' : 'text-gray-400'}`}>
        Thu hồi
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  highlightBubble: {
    position: 'absolute',
    zIndex: 10,
  },
  bubble: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  menuStack: {
    position: 'absolute',
    zIndex: 12,
    alignItems: 'center',
  },
  emojiPill: {
    alignSelf: 'center',
    borderRadius: 9999,
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 10,
    overflow: 'hidden',
  },
  emojiPillScroll: {
    width: '100%',
  },
  emojiPillScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    /** Căn giữa 6 emoji khi hàng vừa pill; màn hẹp vẫn scroll được. */
    minWidth: '100%',
    justifyContent: 'center',
  },
  emojiHit: {
    paddingHorizontal: 4,
  },
  actionCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 12,
  },
});
