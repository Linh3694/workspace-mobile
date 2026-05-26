import { useEffect, useState } from 'react';
import { Text, type TextProps } from 'react-native';

const DOT_CYCLE_MS = 450;
const DOTS = ['.', '..', '...'] as const;

type TypingDotsLineProps = Omit<TextProps, 'children'> & {
  /** Ví dụ: "Lan đang soạn tin nhắn" — không có …; chấm xoay nối vào đuôi */
  baseText: string;
};

/** Đuôi animate . → .. → ... cho cụm trạng thái đang nhập (RN). */
export function TypingDotsLine({ baseText, ...rest }: TypingDotsLineProps) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    setPhase(0);
    const id = setInterval(() => setPhase((p) => (p + 1) % DOTS.length), DOT_CYCLE_MS);
    return () => clearInterval(id);
  }, [baseText]);

  return (
    <Text {...rest}>
      {baseText}
      {DOTS[phase]}
    </Text>
  );
}
