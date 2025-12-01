import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'info';

interface ToastData {
  type: ToastType;
  message: string;
  id: number;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const TOAST_DURATION = 3000;

const getIconConfig = (type: ToastType) => {
  switch (type) {
    case 'success':
      return { name: 'checkmark-circle' as const, color: '#16a34a' };
    case 'error':
      return { name: 'close-circle' as const, color: '#dc2626' };
    case 'info':
      return { name: 'information-circle' as const, color: '#0284c7' };
  }
};

const ToastItem = ({ toastData, onHide }: { toastData: ToastData; onHide: () => void }) => {
  const insets = useSafeAreaInsets();
  const iconConfig = getIconConfig(toastData.type);

  useEffect(() => {
    const timer = setTimeout(() => {
      onHide();
    }, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [onHide]);

  const topOffset = insets.top + 10;

  const ToastContent = (
    <View style={styles.content}>
      <Ionicons name={iconConfig.name} size={20} color={iconConfig.color} style={styles.icon} />
      <Text style={styles.text} numberOfLines={2}>
        {toastData.message}
      </Text>
    </View>
  );

  return (
    <View style={[styles.toastContainer, { top: topOffset }]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint="light" style={styles.toastBox}>
          {ToastContent}
        </BlurView>
      ) : (
        <View style={[styles.toastBox, styles.androidBg]}>
          {ToastContent}
        </View>
      )}
    </View>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toastData, setToastData] = useState<ToastData | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((type: ToastType, message: string) => {
    console.log('🍞 [Toast] Showing:', type, message);
    idRef.current += 1;
    setToastData({ type, message, id: idRef.current });
  }, []);

  const success = useCallback((message: string) => showToast('success', message), [showToast]);
  const error = useCallback((message: string) => showToast('error', message), [showToast]);
  const info = useCallback((message: string) => showToast('info', message), [showToast]);
  const dismiss = useCallback(() => setToastData(null), []);

  return (
    <ToastContext.Provider value={{ success, error, info, dismiss }}>
      <View style={styles.wrapper}>
        {children}
        {toastData && (
          <ToastItem
            key={toastData.id}
            toastData={toastData}
            onHide={() => setToastData(null)}
          />
        )}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Global toast instance for non-component usage
let globalToast: ToastContextType | null = null;

export const setGlobalToast = (toastInstance: ToastContextType) => {
  globalToast = toastInstance;
};

export const toast = {
  success: (message: string) => {
    console.log('🍞 [toast.success] Called:', message);
    globalToast?.success(message);
  },
  error: (message: string) => {
    console.log('🍞 [toast.error] Called:', message);
    globalToast?.error(message);
  },
  info: (message: string) => {
    console.log('🍞 [toast.info] Called:', message);
    globalToast?.info(message);
  },
  dismiss: () => globalToast?.dismiss(),
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  toastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  toastBox: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  androidBg: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
});

export default ToastProvider;
