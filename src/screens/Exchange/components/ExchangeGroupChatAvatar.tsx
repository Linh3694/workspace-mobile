/**
 * Avatar cụm nhóm chat — layout đồng bộ GroupChatAvatar parent-portal (RN Image).
 */
import React, { useMemo } from 'react';
import { Image, Text, View } from 'react-native';

import type { ChatConversation } from '../../../types/chat';

import { getGroupAvatarDisplay } from '../lib/groupChatAvatarLayout';
import { memberToAvatarUri } from '../lib/chatMemberAvatar';

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

  const borderW = 1.5;

  const ring = {
    borderWidth: borderW,
    borderColor: RING_COLOR,
    backgroundColor: '#fff',
  } as const;

  if (display.kind === 'single') {
    const m = display.members[0];
    const uri = m ? memberToAvatarUri(m) : memberToAvatarUri({ key: '', emailNorm: '', name: '', role: 'guardian' });
    const r = size / 2;
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
