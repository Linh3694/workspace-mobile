import React from 'react';
// @ts-ignore
import { View, Image, Text } from 'react-native';
import { API_BASE_URL } from '../config/constants.js';

export type StudentAvatarProps = {
  name?: string;
  avatarUrl?: string;
  size?: number; // px
  backgroundColor?: string; // for initials fallback
  textColor?: string;
  style?: any;
};

// Normalize avatar URL (supports absolute/relative)
const normalizeUrl = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const url = String(raw).trim();
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  if (url.startsWith('files/')) return `${API_BASE_URL}/${url}`;
  if (url.startsWith('Avatar/')) return `${API_BASE_URL}/files/${url}`;
  return `${API_BASE_URL}/${url}`;
};

const getInitials = (name?: string): string => {
  if (!name) return 'HS';
  try {
    const parts = name
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return 'HS';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } catch {
    return 'HS';
  }
};

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  name,
  avatarUrl,
  size = 96,
  backgroundColor = '#EDEDED',
  textColor = '#3F4246',
  style,
}) => {
  const uri = normalizeUrl(avatarUrl);
  const borderRadius = size / 2;
  const initials = getInitials(name);
  const [failed, setFailed] = React.useState(false);

  if (uri && !failed) {
    // Debug current uri (one-time)
    try { console.log('[StudentAvatar] uri:', uri); } catch {}
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius, ...(style || {}) }}
        onError={() => setFailed(true)}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
        ...(style || {}),
      }}
    >
      <Text style={{ color: textColor, fontWeight: '600', fontSize: Math.max(14, size * 0.28) }}>
        {initials}
      </Text>
    </View>
  );
};

export default StudentAvatar;
