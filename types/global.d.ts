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

// For NativeWind className support
declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  
  interface TextProps {
    className?: string;
  }
  
  interface ScrollViewProps {
    className?: string;
  }
  
  interface TouchableOpacityProps {
    className?: string;
  }
  
  interface SafeAreaViewProps {
    className?: string;
  }
  
  interface FlatListProps<ItemT> {
    className?: string;
  }
  
  interface TextInputProps {
    className?: string;
  }
  
  interface ImageProps {
    className?: string;
  }
  
  interface ModalProps {
    className?: string;
  }
  
  interface ActivityIndicatorProps {
    className?: string;
  }
  
  interface RefreshControlProps {
    className?: string;
  }
}

// NativeWind global types
declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      className?: string;
    }
  }
} 