import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../config/constants.js';
import {
  Device,
  DeviceType,
  DevicesResponse,
  DeviceFilter,
  Laptop,
  Monitor,
  Printer,
  Projector,
  Tool,
  Phone,
} from '../types/devices';

// API configuration
// Inventory đã gộp vào Frappe → dùng CHUNG base URL với các service Frappe khác (ticket/CRM…): BASE_URL
// (EXPO_PUBLIC_BASE_URL). Trước đây trỏ API_BASE_URL nên có thể lệch môi trường (staging) so với phần còn lại.
const INVENTORY_API_BASE_URL = BASE_URL;
// Backend inventory đã gộp vào Frappe: erp.api.erp_inventory (thay cho REST /api/inventory cũ đã ngừng).
const INV_METHOD_PREFIX = 'erp.api.erp_inventory';
// User management (dùng cho picker người nhận thiết bị khi assign).
const USER_MGMT_METHOD = 'erp.api.erp_common_user.user_management';

// Pagination state interface
export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalPages: number;
  itemsPerPage: number;
}

// Search and filter params interface - normalized to strings for API
interface SearchFilterParams {
  search?: string;
  status?: string; // Comma-separated if multiple values
  manufacturer?: string; // Comma-separated if multiple values
  type?: string; // Comma-separated if multiple values
  assignedUser?: string;
  room?: string;
  releaseYear?: string | number;
  departments?: string; // Comma-separated if multiple values
}

class DeviceService {
  private async getAuthHeaders() {
    const token =
      (await AsyncStorage.getItem('frappe_token')) || (await AsyncStorage.getItem('authToken'));
    return {
      Authorization: `Bearer ${token}`,
      'X-Frappe-CSRF-Token': token,
      'Content-Type': 'application/json',
    };
  }

  // Helper to convert array filters to comma-separated strings for API
  private normalizeFilterValue(value: string | string[] | undefined): string | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(',') : undefined;
    }
    return value;
  }

  // Generic getDevicesByType method (similar to frappe-sis-frontend pattern)
  async getDevicesByType(
    deviceType: DeviceType,
    filters: DeviceFilter,
    pagination: PaginationState
  ): Promise<{ populatedLaptops: Device[]; pagination: PaginationState }> {
    // Normalize array filters to comma-separated strings for backend
    const searchFilters: SearchFilterParams = {
      search: filters.search,
      status: this.normalizeFilterValue(filters.status),
      manufacturer: this.normalizeFilterValue(filters.manufacturer),
      type: this.normalizeFilterValue(filters.type),
      releaseYear: filters.releaseYear,
      departments: this.normalizeFilterValue(filters.departments),
    };

    let response;
    switch (deviceType) {
      case 'laptop':
        response = await this.getLaptops(pagination.page, pagination.limit, searchFilters);
        break;
      case 'monitor':
        response = await this.getMonitors(pagination.page, pagination.limit, searchFilters);
        break;
      case 'printer':
        response = await this.getPrinters(pagination.page, pagination.limit, searchFilters);
        break;
      case 'tool':
        response = await this.getTools(searchFilters);
        break;
      case 'projector':
        response = await this.getProjectors(pagination.page, pagination.limit, searchFilters);
        break;
      case 'phone':
        response = await this.getPhones(pagination.page, pagination.limit, searchFilters);
        break;
      default:
        throw new Error(`Unsupported device type: ${deviceType}`);
    }

    // Normalize response format
    let devices: Device[] = [];
    let paginationData: PaginationState = { ...pagination, total: 0 };

    if ('populatedLaptops' in response) {
      devices = response.populatedLaptops;
      paginationData = { ...paginationData, ...response.pagination };
    } else if ('populatedMonitors' in response) {
      devices = response.populatedMonitors;
      paginationData = { ...paginationData, ...response.pagination };
    } else if ('populatedPrinters' in response) {
      devices = response.populatedPrinters;
      paginationData = { ...paginationData, ...response.pagination };
    } else if ('populatedTools' in response) {
      devices = response.populatedTools;
      paginationData = { ...paginationData, total: devices.length };
    } else if ('populatedProjectors' in response) {
      devices = response.populatedProjectors;
      paginationData = { ...paginationData, ...response.pagination };
    } else if ('populatedPhones' in response) {
      devices = response.populatedPhones;
      paginationData = { ...paginationData, ...response.pagination };
    }

    return {
      populatedLaptops: devices,
      pagination: paginationData,
    };
  }

  // Chuyển lỗi HTTP thành thông báo tiếng Việt thân thiện, tránh hiển thị HTML thô (vd: trang 502 của nginx)
  private getFriendlyErrorMessage(status: number, errorText: string): string {
    // Ưu tiên dùng message từ JSON nếu backend trả về JSON hợp lệ
    if (errorText) {
      try {
        const errorData = JSON.parse(errorText);
        const message = errorData.message || errorData.error;
        if (message && typeof message === 'string') {
          return message;
        }
      } catch {
        // Không phải JSON: bỏ qua, xử lý theo mã trạng thái bên dưới
      }
    }

    switch (status) {
      case 502:
      case 503:
      case 504:
        return 'Máy chủ đang bận hoặc tạm thời gián đoạn. Vui lòng thử lại sau.';
      case 500:
        return 'Đã xảy ra lỗi từ máy chủ. Vui lòng thử lại sau.';
      case 401:
      case 403:
        return 'Phiên đăng nhập đã hết hạn hoặc không có quyền truy cập.';
      case 404:
        return 'Không tìm thấy dữ liệu yêu cầu.';
      default:
        break;
    }

    // Chỉ dùng errorText khi là chuỗi ngắn và không phải HTML
    const trimmed = errorText?.trim() || '';
    const isHtml = /<!DOCTYPE|<html/i.test(trimmed);
    if (trimmed && !isHtml && trimmed.length <= 200) {
      return trimmed;
    }

    return `Không thể kết nối tới máy chủ (mã lỗi ${status}).`;
  }

  // Enhanced error handling for API calls
  private async makeApiCall(url: string, options: RequestInit = {}) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(this.getFriendlyErrorMessage(response.status, errorText));
      }

      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  // ===== Frappe inventory API (erp.api.erp_inventory) =====
  // Gọi method Frappe và bóc lớp envelope { message: <payload> } mà Frappe trả về.
  private frappeMethodUrl(method: string): string {
    return `${INVENTORY_API_BASE_URL}/api/method/${method}`;
  }

  private unwrapFrappe<T>(json: unknown): T {
    if (json && typeof json === 'object' && 'message' in (json as Record<string, unknown>)) {
      return (json as { message: T }).message;
    }
    return json as T;
  }

  private async frappeGet<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const search = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          search.append(key, String(value));
        }
      }
    }
    // Cache-buster giống web (Frappe bỏ qua kwargs không khai báo nên param thừa là an toàn).
    search.append('_t', String(Date.now()));
    const response = await this.makeApiCall(`${this.frappeMethodUrl(method)}?${search.toString()}`);
    const json = await response.json();
    return this.unwrapFrappe<T>(json);
  }

  private async frappePost<T>(method: string, data?: Record<string, unknown>): Promise<T> {
    const response = await this.makeApiCall(this.frappeMethodUrl(method), {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    });
    const json = await response.json();
    return this.unwrapFrappe<T>(json);
  }

  // GET một method trong module inventory (erp.api.erp_inventory.<method>).
  private invGet<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    return this.frappeGet<T>(`${INV_METHOD_PREFIX}.${method}`, params);
  }

  // POST một method trong module inventory.
  private invPost<T>(method: string, data?: Record<string, unknown>): Promise<T> {
    return this.frappePost<T>(`${INV_METHOD_PREFIX}.${method}`, data);
  }

  // Build params cho device.get_devices. Frappe lọc bỏ kwargs không nhận nên forward đầy đủ là an toàn.
  private buildDeviceParams(
    deviceType: DeviceType,
    page: number,
    limit: number,
    filters?: SearchFilterParams
  ): Record<string, unknown> {
    const params: Record<string, unknown> = { device_type: deviceType, page, limit };
    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;
    if (filters?.manufacturer) params.manufacturer = filters.manufacturer;
    if (filters?.type) params.type = filters.type;
    if (filters?.releaseYear) params.releaseYear = filters.releaseYear;
    if (filters?.departments) params.departments = filters.departments;
    if (filters?.assignedUser) params.assigned = filters.assignedUser;
    if (filters?.room) params.room = filters.room;
    return params;
  }

  // Get laptops with pagination and filters (updated endpoint)
  async getLaptops(
    page: number = 1,
    limit: number = 20,
    filters?: SearchFilterParams
  ): Promise<{ populatedLaptops: Laptop[]; pagination: PaginationState }> {
    const data = await this.invGet<{ populatedLaptops?: Laptop[]; pagination?: PaginationState }>(
      'device.get_devices',
      this.buildDeviceParams('laptop', page, limit, filters)
    );
    return {
      populatedLaptops: data?.populatedLaptops || [],
      pagination: data?.pagination || ({} as PaginationState),
    };
  }

  // Get monitors with pagination and filters (updated endpoint)
  async getMonitors(
    page: number = 1,
    limit: number = 20,
    filters?: SearchFilterParams
  ): Promise<{ populatedMonitors: Monitor[]; pagination: PaginationState }> {
    const data = await this.invGet<{ populatedMonitors?: Monitor[]; pagination?: PaginationState }>(
      'device.get_devices',
      this.buildDeviceParams('monitor', page, limit, filters)
    );
    return {
      populatedMonitors: data?.populatedMonitors || [],
      pagination: data?.pagination || ({} as PaginationState),
    };
  }

  // Get printers with pagination and filters (updated endpoint)
  async getPrinters(
    page: number = 1,
    limit: number = 20,
    filters?: SearchFilterParams
  ): Promise<{ populatedPrinters: Printer[]; pagination: PaginationState }> {
    const data = await this.invGet<{ populatedPrinters?: Printer[]; pagination?: PaginationState }>(
      'device.get_devices',
      this.buildDeviceParams('printer', page, limit, filters)
    );
    return {
      populatedPrinters: data?.populatedPrinters || [],
      pagination: data?.pagination || ({} as PaginationState),
    };
  }

  // Get projectors with pagination and filters (updated endpoint)
  async getProjectors(
    page: number = 1,
    limit: number = 20,
    filters?: SearchFilterParams
  ): Promise<{ populatedProjectors: Projector[]; pagination: PaginationState }> {
    const data = await this.invGet<{
      populatedProjectors?: Projector[];
      pagination?: PaginationState;
    }>('device.get_devices', this.buildDeviceParams('projector', page, limit, filters));
    return {
      populatedProjectors: data?.populatedProjectors || [],
      pagination: data?.pagination || ({} as PaginationState),
    };
  }

  // Get tools (no pagination, updated endpoint)
  async getTools(filters?: SearchFilterParams): Promise<{ populatedTools: Tool[]; total: number }> {
    // Tool không phân trang ở UI mobile → lấy limit lớn để gom toàn bộ.
    const data = await this.invGet<{
      populatedTools?: Tool[];
      pagination?: PaginationState;
    }>('device.get_devices', this.buildDeviceParams('tool', 1, 1000, filters));
    const tools = data?.populatedTools || [];
    return {
      populatedTools: tools,
      total: data?.pagination?.total ?? tools.length,
    };
  }

  // Get phones with pagination and filters (new device type)
  async getPhones(
    page: number = 1,
    limit: number = 20,
    filters?: SearchFilterParams
  ): Promise<{ populatedPhones: Phone[]; pagination: PaginationState }> {
    const data = await this.invGet<{ populatedPhones?: Phone[]; pagination?: PaginationState }>(
      'device.get_devices',
      this.buildDeviceParams('phone', page, limit, filters)
    );
    return {
      populatedPhones: data?.populatedPhones || [],
      pagination: data?.pagination || ({} as PaginationState),
    };
  }

  // Get filter options for each device type (updated endpoints)
  async getFilterOptions(deviceType: DeviceType): Promise<{
    statuses: string[];
    types: string[];
    manufacturers: string[];
    departments: string[];
    yearRange: [number, number];
  }> {
    try {
      const data = await this.invGet<{
        statuses?: string[];
        types?: string[];
        manufacturers?: string[];
        departments?: string[];
        yearRange?: [number, number];
      }>('device.get_device_filters', { device_type: deviceType });
      return {
        statuses: data?.statuses || [],
        types: data?.types || [],
        manufacturers: data?.manufacturers || [],
        departments: data?.departments || [],
        yearRange: data?.yearRange || [2015, 2024],
      };
    } catch (error) {
      console.error('Error fetching filter options:', error);
      // Return fallback data if API fails
      return {
        statuses: ['Active', 'Standby', 'Broken', 'PendingDocumentation'],
        types: [],
        manufacturers: [],
        departments: [],
        yearRange: [2015, 2024],
      };
    }
  }

  // Get device by ID (updated endpoint)
  async getDeviceById(deviceType: DeviceType, id: string): Promise<Device | null> {
    try {
      const data = await this.invGet<Device>('device.get_device_by_id', {
        device_type: deviceType,
        device_id: id,
      });
      return data || null;
    } catch (error) {
      console.error('Error fetching device by ID:', error);
      return null;
    }
  }

  // Create new device
  async createDevice(
    deviceType: DeviceType,
    deviceData: {
      name: string;
      serial: string;
      manufacturer?: string;
      releaseYear?: number;
      type?: string;
      specs?: {
        processor?: string;
        ram?: string;
        storage?: string;
        display?: string;
        resolution?: string;
        ip?: string;
        imei1?: string;
        imei2?: string;
        phoneNumber?: string;
      };
    }
  ): Promise<Device> {
    return this.invPost<Device>('device.create_device', {
      device_type: deviceType,
      ...deviceData,
    });
  }

  // Get device statistics
  async getDeviceStatistics(deviceType: DeviceType): Promise<{
    total: number;
    active: number;
    standby: number;
    broken: number;
  }> {
    try {
      const data = await this.invGet<{
        total?: number;
        active?: number;
        standby?: number;
        broken?: number;
      }>('device.get_device_statistics', { device_type: deviceType });
      return {
        total: data?.total || 0,
        active: data?.active || 0,
        standby: data?.standby || 0,
        broken: data?.broken || 0,
      };
    } catch (error) {
      console.error('Error fetching device statistics:', error);
      return { total: 0, active: 0, standby: 0, broken: 0 };
    }
  }

  // Get device activities
  async getDeviceActivities(deviceType: DeviceType, deviceId: string): Promise<any[]> {
    try {
      const data = await this.invGet<any[] | { data?: any[] }>('activity.get_activities', {
        entity_type: deviceType,
        entity_id: deviceId,
      });
      if (Array.isArray(data)) return data;
      return data?.data || [];
    } catch (error) {
      console.error('Error fetching device activities:', error);
      return [];
    }
  }

  // Add device activity
  async addDeviceActivity(
    deviceType: DeviceType,
    deviceId: string,
    activityData: {
      activityType: string;
      description: string;
      notes?: string;
      updatedBy?: string;
    }
  ): Promise<any> {
    // Lấy thông tin user hiện tại nếu không được truyền vào
    let updatedBy = activityData.updatedBy;
    if (!updatedBy) {
      try {
        const userDataString = await AsyncStorage.getItem('userData');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          updatedBy = userData.fullname || userData.full_name || userData.email || 'Không xác định';
        }
      } catch (e) {
        console.warn('Could not get user data for updatedBy');
      }
    }

    const payload = {
      entityType: deviceType,
      entityId: deviceId,
      type: activityData.activityType,
      description: activityData.description,
      details: activityData.notes || '',
      updatedBy: updatedBy || 'Không xác định',
    };

    return this.invPost<any>('activity.add_activity', payload);
  }

  // Get device inspections
  async getDeviceInspections(deviceType: DeviceType, deviceId: string): Promise<any[]> {
    try {
      const data = await this.invGet<any[] | { data?: any[] }>('inspection.get_inspections', {
        deviceId,
      });
      const list = Array.isArray(data) ? data : data?.data || [];
      return list.filter((inspection: any) => inspection.deviceId === deviceId);
    } catch (error) {
      console.error('Error fetching device inspections:', error);
      return [];
    }
  }

  // Get inspection by ID
  async getInspectionById(inspectionId: string): Promise<any> {
    try {
      return await this.invGet<any>('inspection.get_inspection_by_id', {
        inspection_id: inspectionId,
      });
    } catch (error) {
      console.error('Error fetching inspection by ID:', error);
      return null;
    }
  }

  // Create device inspection
  async createDeviceInspection(
    deviceType: DeviceType,
    deviceId: string,
    inspectionData: {
      inspectionType: string;
      scheduledDate: string;
      notes?: string;
    }
  ): Promise<any> {
    return this.invPost<any>('inspection.create_inspection', {
      deviceId,
      deviceType,
      inspectionType: inspectionData.inspectionType,
      scheduledDate: inspectionData.scheduledDate,
      notes: inspectionData.notes || '',
    });
  }

  // Update device inspection
  async updateDeviceInspection(inspectionId: string, updateData: any): Promise<any> {
    return this.invPost<any>('inspection.update_inspection', {
      inspection_id: inspectionId,
      ...updateData,
    });
  }

  // Assign device to user
  async assignDevice(
    deviceType: DeviceType,
    deviceId: string,
    userId: string,
    userName?: string,
    reason?: string
  ): Promise<any> {
    // Frappe device.assign_device dùng field assignedTo (như web). userName gửi kèm để hiển thị (BE bỏ qua nếu không nhận).
    const payload: Record<string, unknown> = {
      device_type: deviceType,
      device_id: deviceId,
      assignedTo: userId,
    };
    if (userName) payload.userName = userName;
    if (reason) payload.reason = reason;

    return this.invPost<any>('device.assign_device', payload);
  }

  // Revoke device from user
  async revokeDevice(
    deviceType: DeviceType,
    deviceId: string,
    reasons: string[],
    status: string = 'Standby'
  ): Promise<any> {
    return this.invPost<any>('device.revoke_device', {
      device_type: deviceType,
      device_id: deviceId,
      reasons,
      status,
    });
  }

  // Update device status
  async updateDeviceStatus(
    deviceType: DeviceType,
    deviceId: string,
    status: string,
    brokenReason?: string,
    brokenDescription?: string
  ): Promise<any> {
    const payload: Record<string, unknown> = {
      device_type: deviceType,
      device_id: deviceId,
      status,
    };
    if (brokenReason) payload.brokenReason = brokenReason;
    if (brokenDescription) payload.brokenDescription = brokenDescription;

    return this.invPost<any>('device.update_device_status', payload);
  }

  // Get all rooms
  async getAllRooms(): Promise<any[]> {
    try {
      const data = await this.invGet<{ rooms?: any[]; data?: any[] } | any[]>('room.get_all_rooms');
      if (Array.isArray(data)) return data;
      return data?.rooms || data?.data || [];
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }
  }

  // Assign device to room (cập nhật field room qua device.update_device như web)
  async assignDeviceToRoom(deviceType: DeviceType, deviceId: string, roomId: string): Promise<any> {
    return this.invPost<any>('device.update_device', {
      device_type: deviceType,
      device_id: deviceId,
      room: roomId,
    });
  }

  // Delete/Dispose device
  async deleteDevice(deviceType: DeviceType, deviceId: string): Promise<any> {
    return this.invPost<any>('device.delete_device', {
      device_type: deviceType,
      device_id: deviceId,
    });
  }

  // Get users for assignment with pagination and search
  async getUsers(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<{
    users: any[];
    pagination: { page: number; limit: number; total: number; hasNext: boolean };
  }> {
    try {
      const params: Record<string, unknown> = { page, limit, active: 1 };
      if (search && search.trim()) params.search = search.trim();

      const data = await this.frappeGet<{
        users?: any[];
        data?: any[];
        total?: number;
        pagination?: { total?: number };
      }>(`${USER_MGMT_METHOD}.get_users`, params);

      // Handle different response formats
      const users = data?.users || data?.data || [];
      const total = data?.pagination?.total ?? data?.total ?? users.length;
      const hasNext = page * limit < total;

      return {
        users,
        pagination: {
          page,
          limit,
          total,
          hasNext,
        },
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      return {
        users: [],
        pagination: { page: 1, limit: 20, total: 0, hasNext: false },
      };
    }
  }

  // Legacy method - Get all users for assignment (backward compatibility)
  async getAllUsers(search?: string): Promise<any[]> {
    const result = await this.getUsers(1, 100, search);
    return result.users;
  }

  // Legacy methods for backward compatibility
  async getDevicesByTypeOld(
    deviceType: DeviceType,
    page: number = 1,
    limit: number = 20
  ): Promise<{ devices: Device[]; pagination: any }> {
    const result = await this.getDevicesByType(
      deviceType,
      {},
      { page, limit, total: 0, hasNext: false, hasPrev: false, totalPages: 0, itemsPerPage: limit }
    );
    return {
      devices: result.populatedLaptops,
      pagination: result.pagination,
    };
  }

  filterDevices(devices: Device[], filter: DeviceFilter): Device[] {
    return devices.filter((device) => {
      // Search filter
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matchesSearch =
          device.name.toLowerCase().includes(searchLower) ||
          device.serial.toLowerCase().includes(searchLower) ||
          (device.manufacturer && device.manufacturer.toLowerCase().includes(searchLower)) ||
          device.assigned?.some((user) => {
            const userName = user.fullname || user.name || '';
            return userName.toLowerCase().includes(searchLower);
          }) ||
          (device.room && device.room.name.toLowerCase().includes(searchLower));

        if (!matchesSearch) return false;
      }

      // Status filter - supports array of statuses
      if (filter.status && filter.status.length > 0) {
        const statusArray = Array.isArray(filter.status) ? filter.status : [filter.status];
        if (!statusArray.includes(device.status)) {
          return false;
        }
      }

      // Manufacturer filter - supports array of manufacturers
      if (filter.manufacturer && filter.manufacturer.length > 0) {
        const manuArray = Array.isArray(filter.manufacturer)
          ? filter.manufacturer
          : [filter.manufacturer];
        if (
          !device.manufacturer ||
          !manuArray.some((m) => device.manufacturer?.toLowerCase().includes(m.toLowerCase()))
        ) {
          return false;
        }
      }

      // Room filter
      if (filter.room && (!device.room || device.room.name !== filter.room)) {
        return false;
      }

      // Assigned filter
      if (filter.assigned !== undefined) {
        const isAssigned = device.assigned && device.assigned.length > 0;
        if (filter.assigned !== isAssigned) {
          return false;
        }
      }

      return true;
    });
  }
}

export default new DeviceService();
