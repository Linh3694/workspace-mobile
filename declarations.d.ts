declare module '*.svg' {
  import * as React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

declare module '*.wav' {
  const content: number;
  export default content;
}

declare module '*.mp3' {
  const content: number;
  export default content;
}
