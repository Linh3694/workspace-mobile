/**
 * Avatar cụm nhóm chat — layout đồng bộ GroupChatAvatar parent-portal (RN Image).
 */
import React, { useMemo } from 'react';
import { Image, Text, View } from 'react-native';

import type { ChatConversation } from '../../../types/chat';

import { getGroupAvatarDisplay } from '../lib/groupChatAvatarLayout';
import { memberToAvatarUri } from '../lib/chatMemberAvatar';
import { classAvatarColor, classAvatarFontSize, classAvatarLabel } from '../lib/classAvatar';
import { useClassPhoto } from '../lib/useClassPhoto';

const RING_COLOR = '#E5E7EB';

/** Đường kính vòng trong cụm 2×2 / overflow: > size/2 để hơi đè nhau, vẫn gọn trong khung (đồng bộ 1-1). */
function overlapQuadDiscDiameter(size: number, borderW: number) {
  return Math.max(8, Math.min(size - borderW * 2, size * 0.59));
}

/** Tam giác 3 người: vòng lớn hơn nửa khung để ba vòng chồng nhẹ. */
function overlapTripleDiscDiameter(size: number, borderW: number) {
  return Math.max(8, Math.min(size - borderW * 2, size * 0.56));
}

type Props = {
  conversation: ChatConversation;
  viewerEmails: string[];
  size?: number;
};

export function ExchangeGroupChatAvatar({ conversation, viewerEmails, size = 44 }: Props) {
  const viewerNorm = useMemo(
    () => new Set(viewerEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
    [viewerEmails]
  );

  const display = useMemo(
    () => getGroupAvatarDisplay(conversation, viewerNorm),
    [conversation, viewerNorm]
  );

  const isClassGroup = conversation.type === 'class_general';
  const classPhotoUrl = useClassPhoto(
    conversation.classId,
    conversation.schoolYearId,
    isClassGroup
  );

  const borderW = 1.5;

  const ring = {
    borderWidth: borderW,
    borderColor: RING_COLOR,
    backgroundColor: '#fff',
  } as const;

  // Nhóm lớp → ảnh lớp theo năm (SIS Photo); chưa có ảnh thì rơi về vòng tròn màu + mã lớp.
  if (isClassGroup) {
    const r = size / 2;
    if (classPhotoUrl) {
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: r,
            overflow: 'hidden',
            ...ring,
          }}>
          <Image
            source={{ uri: classPhotoUrl }}
            style={{ width: size, height: size }}
            resizeMode="cover"
          />
        </View>
      );
    }
    const label = classAvatarLabel(conversation.className);
    const bg = classAvatarColor(conversation.classId || conversation.className || label);
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          borderWidth: borderW,
          borderColor: 'rgba(255,255,255,0.7)',
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text
          style={{
            fontFamily: 'Mulish-Bold',
            fontSize: classAvatarFontSize(size, label),
            color: '#fff',
          }}
          numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }

  if (display.kind === 'single') {
    const m = display.members[0];
    const uri = m ? memberToAvatarUri(m) : '';
    const r = size / 2;
    // Không có ảnh thật → initials tên người (tránh ui-avatars / mã lớp N0, T0…).
    if (!uri) {
      const rawName = String(m?.name || '').trim();
      const initials = rawName && !rawName.includes('@')
        ? rawName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w.charAt(0).toUpperCase())
            .join('') || 'PH'
        : 'PH';
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: r,
            backgroundColor: '#F97316',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: borderW,
            borderColor: 'rgba(255,255,255,0.7)',
          }}>
          <Text
            style={{
              fontFamily: 'Mulish-Bold',
              fontSize: Math.round(size * (initials.length >= 3 ? 0.28 : 0.36)),
              color: '#fff',
            }}
            numberOfLines={1}>
            {initials}
          </Text>
        </View>
      );
    }
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          overflow: 'hidden',
          ...ring,
        }}>
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      </View>
    );
  }

  if (display.kind === 'triple') {
    const [a, b, c] = display.members;
    const uris = [a, b, c].map((x) =>
      x ? memberToAvatarUri(x) : memberToAvatarUri({ key: '', emailNorm: '', name: '', role: 'guardian' })
    );
    const d = overlapTripleDiscDiameter(size, borderW);
    const r = d / 2;
    return (
      <View style={{ width: size, height: size, position: 'relative' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: size / 2 - d / 2,
            width: d,
            height: d,
            borderRadius: r,
            overflow: 'hidden',
            zIndex: 1,
            ...ring,
          }}>
          <Image source={{ uri: uris[0] }} style={{ width: d, height: d }} resizeMode="cover" />
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: d,
            height: d,
            borderRadius: r,
            overflow: 'hidden',
            zIndex: 2,
            ...ring,
          }}>
          <Image source={{ uri: uris[1] }} style={{ width: d, height: d }} resizeMode="cover" />
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: d,
            height: d,
            borderRadius: r,
            overflow: 'hidden',
            zIndex: 3,
            ...ring,
          }}>
          <Image source={{ uri: uris[2] }} style={{ width: d, height: d }} resizeMode="cover" />
        </View>
      </View>
    );
  }

  if (display.kind === 'quad') {
    const uris = display.members.map((x) => memberToAvatarUri(x));
    const d = overlapQuadDiscDiameter(size, borderW);
    const r = d / 2;
    const corners = [
      { top: 0, left: 0, z: 1 },
      { top: 0, left: size - d, z: 2 },
      { top: size - d, left: 0, z: 3 },
      { top: size - d, left: size - d, z: 4 },
    ] as const;
    return (
      <View style={{ width: size, height: size, position: 'relative' }}>
        {uris.map((uri, i) => (
          <View
            key={String(i)}
            style={{
              position: 'absolute',
              width: d,
              height: d,
              borderRadius: r,
              overflow: 'hidden',
              top: corners[i].top,
              left: corners[i].left,
              zIndex: corners[i].z,
              ...ring,
            }}>
            <Image source={{ uri }} style={{ width: d, height: d }} resizeMode="cover" />
          </View>
        ))}
      </View>
    );
  }

  const uris = display.members.map((x) => memberToAvatarUri(x));
  const count = display.overflowCount;
  const d = overlapQuadDiscDiameter(size, borderW);
  const r = d / 2;
  const countFont = Math.max(9, d - borderW * 2);

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {(
        [
          { top: 0, left: 0, z: 1 },
          { top: 0, left: size - d, z: 2 },
          { top: size - d, left: 0, z: 3 },
        ] as const
      ).map((pos, idx) => (
        <View
          key={`m-${idx}`}
          style={{
            position: 'absolute',
            width: d,
            height: d,
            borderRadius: r,
            overflow: 'hidden',
            top: pos.top,
            left: pos.left,
            zIndex: pos.z,
            ...ring,
          }}>
          <Image source={{ uri: uris[idx] }} style={{ width: d, height: d }} resizeMode="cover" />
        </View>
      ))}
      <View
        style={{
          position: 'absolute',
          width: d,
          height: d,
          borderRadius: r,
          overflow: 'hidden',
          top: size - d,
          left: size - d,
          zIndex: 5,
          ...ring,
          backgroundColor: '#E5E7EB',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text
          style={{
            fontFamily: 'Mulish-Bold',
            fontSize: count >= 10 ? countFont * 0.26 : countFont * 0.32,
            color: '#4B5563',
          }}
          numberOfLines={1}>
          {count}
        </Text>
      </View>
    </View>
  );
}
