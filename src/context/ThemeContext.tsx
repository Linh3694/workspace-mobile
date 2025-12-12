// Context để quản lý theme trong app
// Theme được set cứng trong themeConfig.ts, không thay đổi trong runtime

import React, { createContext, useContext, ReactNode } from 'react';
import { Theme, getActiveTheme } from '../theme/themeConfig';

interface ThemeContextType {
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Theme được lấy 1 lần duy nhất khi app khởi động
  // Không thay đổi trong suốt runtime
  const theme = getActiveTheme();

  return <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>;
};

// Hook để sử dụng theme
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
