/**
 * Lớp tương thích thay cho `Video` của expo-av (đã ngừng ở SDK 54, không build được với SDK 57).
 * Giữ nguyên tên prop quen thuộc (source, resizeMode, shouldPlay, isLooping, isMuted, volume,
 * positionMillis, useNativeControls, onLoad, ref.setPositionAsync) nhưng chạy bằng expo-video.
 */
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView, type VideoContentFit, type VideoSource } from 'expo-video';

export enum ResizeMode {
  CONTAIN = 'contain',
  COVER = 'cover',
  STRETCH = 'fill',
}

export type VideoHandle = {
  setPositionAsync: (positionMillis: number) => Promise<void>;
  playAsync: () => Promise<void>;
  pauseAsync: () => Promise<void>;
  unloadAsync: () => Promise<void>;
};

export type VideoProps = {
  source: VideoSource;
  style?: StyleProp<ViewStyle>;
  className?: string;
  resizeMode?: ResizeMode | VideoContentFit;
  useNativeControls?: boolean;
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  volume?: number;
  positionMillis?: number;
  onLoad?: () => void;
  onError?: (error: unknown) => void;
  pointerEvents?: ViewProps['pointerEvents'];
};

export const Video = forwardRef<VideoHandle, VideoProps>(function Video(
  {
    source,
    style,
    className,
    resizeMode = ResizeMode.CONTAIN,
    useNativeControls = true,
    shouldPlay = false,
    isLooping = false,
    isMuted = false,
    volume = 1,
    positionMillis,
    onLoad,
    onError,
    pointerEvents,
  },
  ref,
) {
  const loadedRef = useRef(false);
  const player = useVideoPlayer(source, (p) => {
    p.loop = isLooping;
    p.muted = isMuted;
    p.volume = volume;
    if (positionMillis) p.currentTime = positionMillis / 1000;
    if (shouldPlay) p.play();
  });

  useEffect(() => {
    player.loop = isLooping;
  }, [player, isLooping]);
  useEffect(() => {
    player.muted = isMuted;
  }, [player, isMuted]);
  useEffect(() => {
    player.volume = volume;
  }, [player, volume]);
  useEffect(() => {
    if (shouldPlay) player.play();
    else player.pause();
  }, [player, shouldPlay]);

  useEffect(() => {
    loadedRef.current = false;
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'readyToPlay' && !loadedRef.current) {
        loadedRef.current = true;
        onLoad?.();
      } else if (status === 'error') {
        onError?.(error);
      }
    });
    return () => sub.remove();
  }, [player, onLoad, onError]);

  useImperativeHandle(
    ref,
    () => ({
      setPositionAsync: async (ms: number) => {
        player.currentTime = ms / 1000;
      },
      playAsync: async () => player.play(),
      pauseAsync: async () => player.pause(),
      unloadAsync: async () => player.pause(),
    }),
    [player],
  );

  return (
    <View style={style} className={className} pointerEvents={pointerEvents}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={resizeMode as VideoContentFit}
        nativeControls={useNativeControls}
      />
    </View>
  );
});

export default Video;
