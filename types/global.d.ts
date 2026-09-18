/// <reference types="nativewind/types" />

declare module '*.png' {
  const value: any;
  export default value;
}

declare module '*.jpg' {
  const value: any;
  export default value;
}

declare module '*.jpeg' {
  const value: any;
  export default value;
}

declare module '*.svg' {
  const value: any;
  export default value;
}

// Extend React Native components to support className prop from NativeWind
declare namespace React {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    className?: string;
  }
}

// className cho component RN đã có sẵn qua /// <reference types="nativewind/types" /> ở đầu file.
// Không khai báo `declare module 'react-native'` trong file script: với TS 6 nó thành ambient module
// thay thế toàn bộ type của react-native (mọi import View/Text... đều lỗi 'no exported member').

// NativeWind global types
declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      className?: string;
    }
  }
} 
// TS 6: import side-effect './global.css' cần khai báo module
declare module '*.css';
