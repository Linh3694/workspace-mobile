/**
 * Gọi notification-service (REST /api/notifications/*) với Bearer JWT nhân viên.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

import { NOTIFICATION_API_BASE_URL, API_BASE_URL } from '../config/constants';

const FRAPPE_REGISTER =
  '/api/method/erp.api.erp_sis.mobile_push_notification.register_device_token';
const FRAPPE_UNREGISTER =
  '/api/method/erp.api.erp_sis.mobile_push_notification.unregister_device_token';

export async function notificationRequest(config) {
  const token = await AsyncStorage.getItem('authToken');
  const urlBase = `${NOTIFICATION_API_BASE_URL.replace(/\/+$/, '')}`;
  return axios({
    ...config,
    baseURL: urlBase,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...config.headers,
    },
    timeout: config.timeout ?? 20000,
  });
}

/** Đăng ký Expo token vào Postgres notification-service + Frappe (dual-write). */
export async function registerDeviceOnNotificationService(deviceInfo) {
  const res = await notificationRequest({
    method: 'POST',
    url: '/api/notifications/devices/register',
    data: deviceInfo,
  });

  // Luôn dual-write Frappe: hiện Frappe là nơi gửi Expo push chính (attendance,
  // contact log...), nên token phải tồn tại ở cả hai store. Đây là đường đăng ký
  // DUY NHẤT của app — App.tsx / ProfileScreen không tự gọi Frappe nữa.
  const authToken = await AsyncStorage.getItem('authToken');
  if (authToken) {
    try {
      await axios.post(`${API_BASE_URL}${FRAPPE_REGISTER}`, deviceInfo, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (_e) {
      /* không chặn đường chính */
    }
  }

  return res;
}

export async function unregisterDeviceOnNotificationService(deviceToken) {
  await notificationRequest({
    method: 'POST',
    url: '/api/notifications/devices/unregister',
    data: deviceToken ? { deviceToken } : {},
  });

  // Luôn unregister cả phía Frappe: App.tsx đăng ký thẳng vào Frappe (không phụ thuộc
  // DEVICE_TOKEN_DUAL_WRITE), nên nếu chỉ gỡ ở notification-service thì token Frappe
  // vẫn active và user cũ tiếp tục nhận push sau logout.
  if (deviceToken) {
    const authToken = await AsyncStorage.getItem('authToken');
    if (authToken) {
      try {
        await axios.post(
          `${API_BASE_URL}${FRAPPE_UNREGISTER}`,
          { deviceToken },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          },
        );
      } catch (_e) {
        /* ignore */
      }
    }
  }
}
