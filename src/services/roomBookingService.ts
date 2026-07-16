/**
 * Đặt phòng (ERP Room Booking) — gọi Frappe erp.api.erp_administrative.room_booking(_config).
 * Đồng bộ logic web frappe-sis-frontend (trang "Đặt phòng").
 *
 * Dùng chung pattern với administrativeTicketService (axios + Bearer token + unwrap
 * envelope Frappe {message:{success,data,message}}). Các method erp_administrative
 * lấy campus theo session nên không cần header X-Campus-Id (giống get_room_event_bookings).
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants';
import { parseFrappeApiError } from './administrativeTicketService';
import type { BookableRoom, RoomBooking, CreateRoomBookingPayload } from '../types/roomBooking';

const getAxiosConfig = async (additionalConfig: { headers?: Record<string, string> } = {}) => {
  const token = await AsyncStorage.getItem('authToken');
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return {
    baseURL: BASE_URL,
    timeout: 120000,
    ...additionalConfig,
    headers: { ...defaultHeaders, ...(additionalConfig.headers || {}) },
  };
};

const ROOM_BOOKING = '/api/method/erp.api.erp_administrative.room_booking';
const ROOM_BOOKING_CONFIG = '/api/method/erp.api.erp_administrative.room_booking_config';

function unwrap<T>(response: {
  data?: { message?: { success?: boolean; data?: T; message?: string }; exc?: string };
}): { success: boolean; data?: T; message?: string } {
  const msg = response?.data?.message ?? response?.data;
  if (msg && typeof msg === 'object' && 'success' in msg && (msg as { success?: boolean }).success === true) {
    const m = msg as { data?: T; message?: string };
    return { success: true, data: m.data, message: typeof m.message === 'string' ? m.message : undefined };
  }
  const fallback =
    (msg && typeof msg === 'object' && 'message' in msg && typeof (msg as { message?: string }).message === 'string'
      ? (msg as { message: string }).message
      : null) || parseFrappeApiError(response?.data);
  return { success: false, message: fallback || 'Lỗi API' };
}

/** Danh sách phòng đang mở đặt (chỉ phòng có config is_active=1), kèm availability theo thứ. */
export async function getBookableRooms(schoolYearId?: string): Promise<BookableRoom[]> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(
      `${ROOM_BOOKING_CONFIG}.get_bookable_rooms`,
      schoolYearId ? { school_year_id: schoolYearId } : {},
      config
    );
    const out = unwrap<{ rooms?: BookableRoom[] }>(response);
    if (out.success && Array.isArray(out.data?.rooms)) return out.data!.rooms;
    return [];
  } catch (e) {
    console.error('getBookableRooms', e);
    return [];
  }
}

/** Lịch đã đặt của phòng trong khoảng (đã loại Cancelled, server order by start_time asc). */
export async function getRoomBookings(params: {
  room_id: string;
  range_start?: string;
  range_end?: string;
}): Promise<RoomBooking[]> {
  try {
    const config = await getAxiosConfig();
    const response = await axios.post(`${ROOM_BOOKING}.get_room_bookings`, params, config);
    const out = unwrap<{ bookings?: RoomBooking[] }>(response);
    if (out.success && Array.isArray(out.data?.bookings)) return out.data!.bookings;
    return [];
  } catch (e) {
    console.error('getRoomBookings', e);
    return [];
  }
}

/**
 * Tạo booking (đặt phòng thường). Ném Error với message thật khi thất bại
 * (kể cả lỗi validate field-keyed: trùng lịch, ngoài giờ, khác ngày...).
 */
export async function createRoomBooking(payload: CreateRoomBookingPayload): Promise<RoomBooking> {
  const config = await getAxiosConfig();
  const response = await axios.post(`${ROOM_BOOKING}.create_room_booking`, payload, {
    ...config,
    validateStatus: (status) => status >= 200 && status < 600,
  });
  if (response.status >= 400) {
    throw new Error(parseFrappeApiError(response.data));
  }
  const out = unwrap<RoomBooking>(response);
  if (!out.success || !out.data) {
    throw new Error(out.message || parseFrappeApiError(response.data));
  }
  return out.data;
}

/** Huỷ booking — backend chỉ cho người đặt (booked_by_email) huỷ, và không huỷ booking gắn ticket. */
export async function cancelRoomBooking(bookingId: string): Promise<RoomBooking> {
  const config = await getAxiosConfig();
  const response = await axios.post(
    `${ROOM_BOOKING}.cancel_room_booking`,
    { booking_id: bookingId },
    { ...config, validateStatus: (status) => status >= 200 && status < 600 }
  );
  if (response.status >= 400) {
    throw new Error(parseFrappeApiError(response.data));
  }
  const out = unwrap<RoomBooking>(response);
  if (!out.success || !out.data) {
    throw new Error(out.message || parseFrappeApiError(response.data));
  }
  return out.data;
}
