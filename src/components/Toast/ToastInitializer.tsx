import { useEffect } from 'react';
import { useToast, setGlobalToast } from './ToastProvider';

// Component này dùng để khởi tạo global toast instance
export const ToastInitializer = () => {
  const toastInstance = useToast();

  useEffect(() => {
    console.log('🍞 [ToastInitializer] Setting global toast instance');
    setGlobalToast(toastInstance);
  }, [toastInstance]);

  return null;
};

export default ToastInitializer;

