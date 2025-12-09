# Parent Portal Session Tracking - Integration Guide

## 📋 Mục đích

Track khi phụ huynh mở app hoặc resume app để hiển thị chính xác trong **"Đăng nhập gần đây"** trên Parent Portal Analytics Dashboard.

## 🎯 Cần track

1. **App Start** (Cold start) - Khi phụ huynh mở app lần đầu
2. **App Resume** (From background) - Khi phụ huynh quay lại app từ background
3. **Optional**: App Close/Background - Khi phụ huynh thoát hoặc minimize app

## 🔧 Integration Steps

### 1. Import Service

```typescript
import sessionTrackingService from '@/services/sessionTracking';
```

### 2. Track App Start/Resume

#### React Native - Using AppState

```typescript
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import sessionTrackingService from '@/services/sessionTracking';
import { useAuth } from '@/contexts/AuthContext';

export function useSessionTracking() {
  const appState = useRef(AppState.currentState);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Track initial app start
    if (isAuthenticated) {
      sessionTrackingService.trackAppSession();
    }

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // When app comes to foreground from background
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isAuthenticated
      ) {
        console.log('📱 App resumed from background - tracking session');
        sessionTrackingService.trackAppSession();
      }

      // Optional: Track when app goes to background
      if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/) &&
        isAuthenticated
      ) {
        console.log('📱 App going to background - tracking close');
        sessionTrackingService.trackAppClose();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);
}
```

#### Expo - Using expo-app-state

```typescript
import { useEffect } from 'react';
import { useAppState } from '@react-native-community/hooks';
import sessionTrackingService from '@/services/sessionTracking';
import { useAuth } from '@/contexts/AuthContext';

export function useSessionTracking() {
  const currentAppState = useAppState();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Track when app becomes active
    if (currentAppState === 'active' && isAuthenticated) {
      sessionTrackingService.trackAppSession();
    }

    // Optional: Track when app goes to background
    if (currentAppState === 'background' && isAuthenticated) {
      sessionTrackingService.trackAppClose();
    }
  }, [currentAppState, isAuthenticated]);
}
```

### 3. Add Hook to App Root

```typescript
// In App.tsx or Root component
import { useSessionTracking } from '@/hooks/useSessionTracking';

function App() {
  useSessionTracking(); // Add this hook

  return (
    // ... your app content
  );
}
```

## 📊 Kết quả

Sau khi integrate:

✅ Khi phụ huynh **mở app** → API được gọi → Backend log event `app_session`  
✅ Khi phụ huynh **resume app** → API được gọi → Backend log event `app_session`  
✅ Dashboard hiển thị **"Mở App"** trong danh sách "Đăng nhập gần đây"  
✅ Phân biệt được giữa **"OTP Login"** (màu xanh lá) và **"Mở App"** (màu xanh dương)

## 🔍 Testing

1. Open mobile app → Check terminal logs cho "📱 App session tracked"
2. Background app → Open lại → Check logs
3. Check Parent Portal Analytics Dashboard → Xem "Đăng nhập gần đây"
4. Verify có entry mới với label "Mở App"

## 📝 Notes

- API call fail **silently** - không ảnh hưởng đến UX
- Chỉ track khi user đã authenticated
- Backend tự động lưu: guardian name, phone, IP, timestamp
- Data được sử dụng cho analytics: DAU, MAU, activity trends

## 🐛 Troubleshooting

**Problem**: Không thấy "Mở App" entries trong dashboard

**Solutions**:

1. Check mobile app logs - có call API không?
2. Check backend logs (`/logs/logging.log`) - có entries với `action: 'app_session'` không?
3. Verify user có email `@parent.wellspring.edu.vn`
4. Check API permissions - endpoint có allow_guest=False

## 🔗 Related Files

- Backend API: `/apps/erp/erp/api/parent_portal/session_tracking.py`
- Mobile Service: `/src/services/sessionTracking.ts`
- Analytics Backend: `/apps/erp/erp/api/analytics/portal_analytics.py`
- Frontend Component: `/src/pages/Reports/ParentPortalDashboard/components/RecentLoginList.tsx`
