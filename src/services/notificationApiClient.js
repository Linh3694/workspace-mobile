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

/** POST tới Frappe kèm Bearer JWT. Trả null khi chưa đăng nhập. */
async function frappePost(path, body) {
  const authToken = await AsyncStorage.getItem('authToken');
  if (!authToken) return null;
  return axios.post(`${API_BASE_URL}${path}`, body, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * HAI KHO TOKEN ĐỘC LẬP — phải ghi độc lập.
 *
 * Trước đây `await notificationRequest(...)` đứng trần ở đầu hàm: khi notification-service
 * lỗi (404 vì Nginx chưa proxy `/api/notifications/*`, timeout, 401) là hàm ném ngay và
 * dual-write Frappe phía dưới KHÔNG BAO GIỜ chạy → token không nằm ở kho nào cả, user
 * không nhận được gì. Frappe vẫn là nơi gửi Expo push chính cho attendance/contact log
 * khi `MOBILE_NOTIFY_VIA_REDIS_STREAM_ONLY` tắt, nên mất kho này là mất luôn các luồng đó.
 *
 * Coi là thành công khi ghi được ÍT NHẤT MỘT kho — client không biết (và không nên đoán)
 * đường gửi hiện tại đang đọc kho nào. Cùng pattern với parent-portal-mobile
 * (services/pushNotificationService.ts).
 */
export async function registerDeviceOnNotificationService(deviceInfo) {
  const settled = await Promise.allSettled([
    notificationRequest({
      method: 'POST',
      url: '/api/notifications/devices/register',
      data: deviceInfo,
    }),
    frappePost(FRAPPE_REGISTER, deviceInfo),
  ]);

  const [notifResult, frappeResult] = settled;
  const names = ['notification-service', 'frappe'];
  settled.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`⚠️ [push] đăng ký token hỏng ở ${names[i]}:`, r.reason?.message || r.reason);
    }
  });

  if (notifResult.status === 'fulfilled') return notifResult.value;
  // notification-service hỏng nhưng Frappe ghi được ⇒ vẫn tính là đăng ký thành công.
  if (frappeResult.status === 'fulfilled' && frappeResult.value) return frappeResult.value;

  throw notifResult.reason;
}

/**
 * Gỡ token ở CẢ HAI kho — độc lập, cùng lý do như register.
 *
 * Sót một kho là user cũ tiếp tục nhận push sau khi logout, nên không được để lỗi của
 * kho này chặn kho kia.
 */
export async function unregisterDeviceOnNotificationService(deviceToken) {
  const calls = [
    notificationRequest({
      method: 'POST',
      url: '/api/notifications/devices/unregister',
      data: deviceToken ? { deviceToken } : {},
    }),
  ];
  if (deviceToken) {
    calls.push(frappePost(FRAPPE_UNREGISTER, { deviceToken }));
  }

  const settled = await Promise.allSettled(calls);
  const names = ['notification-service', 'frappe'];
  settled.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`⚠️ [push] gỡ token hỏng ở ${names[i]}:`, r.reason?.message || r.reason);
    }
  });
}
