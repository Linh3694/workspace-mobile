import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/constants.js';
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
const INVENTORY_API_BASE_URL = API_BASE_URL;

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
  status?: string;  // Comma-separated if multiple values
  manufacturer?: string;  // Comma-separated if multiple values
  type?: string;  // Comma-separated if multiple values
  assignedUser?: string;
  room?: string;
  releaseYear?: string | number;
  departments?: string;  // Comma-separated if multiple values
}

// API params interface
interface ApiParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  manufacturer?: string;
  type?: string;
  assignedUser?: string;
  room?: string;
  releaseYear?: string | number;
}

class DeviceService {
  private async getAuthHeaders() {
    const token = await AsyncStorage.getItem('frappe_token') || await AsyncStorage.getItem('authToken');
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
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // If not JSON, use the raw error text
          if (errorText) {
            errorMessage = errorText.substring(0, 200);
          }
        }

        throw new Error(errorMessage);
      }

      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  // Get laptops with pagination and filters (updated endpoint)
  async getLaptops(
    page: number = 1,
    limit: number = 20,
    filters?: SearchFilterParams
  ): Promise<{ populatedLaptops: Laptop[]; pagination: PaginationState }> {
    const params: ApiParams = { page, limit };
    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;
    if (filters?.manufacturer) params.manufacturer = filters.manufacturer;
    if (filters?.type) params.type = filters.type;
    if (filters?.releaseYear) params.releaseYear = filters.releaseYear;

    const queryString = new URLSearchParams(params as any).toString();
    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/laptops?${queryString}`);
    const data = await response.json();

    return {
      populatedLaptops: data.populatedLaptops || [],
      pagination: data.pagination || {},
    };
  }

  // Get monitors with pagination and filters (updated endpoint)
  async getMonitors(
    page: number = 1,
    limit: number = 20,
    filters?: SearchFilterParams
  ): Promise<{ populatedMonitors: Monitor[]; pagination: PaginationState }> {
    const params: ApiParams = { page, limit };
    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;
    if (filters?.manufacturer) params.manufacturer = filters.manufacturer;
    if (filters?.type) params.type = filters.type;
    if (filters?.releaseYear) params.releaseYear = filters.releaseYear;

    const queryString = new URLSearchParams(params as any).toString();
    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/monitors?${queryString}`);
    const data = await response.json();

    return {
      populatedMonitors: data.populatedMonitors || [],
      pagination: data.pagination || {},
    };
  }

  // Get printers with pagination and filters (updated endpoint)
  async getPrinters(
    page: number = 1,
    limit: number = 20,
    filters?: SearchFilterParams
  ): Promise<{ populatedPrinters: Printer[]; pagination: PaginationState }> {
    const params: ApiParams = { page, limit };
    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;
    if (filters?.manufacturer) params.manufacturer = filters.manufacturer;
    if (filters?.type) params.type = filters.type;
    if (filters?.releaseYear) params.releaseYear = filters.releaseYear;

    const queryString = new URLSearchParams(params as any).toString();
    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/printers?${queryString}`);
    const data = await response.json();

    return {
      populatedPrinters: data.populatedPrinters || [],
      pagination: data.pagination || {},
    };
  }

  // Get projectors with pagination and filters (updated endpoint)
  async getProjectors(
    page: number = 1,
    limit: number = 20,
    filters?: SearchFilterParams
  ): Promise<{ populatedProjectors: Projector[]; pagination: PaginationState }> {
    const params: ApiParams = { page, limit };
    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;
    if (filters?.manufacturer) params.manufacturer = filters.manufacturer;
    if (filters?.type) params.type = filters.type;
    if (filters?.releaseYear) params.releaseYear = filters.releaseYear;

    const queryString = new URLSearchParams(params as any).toString();
    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/projectors?${queryString}`);
    const data = await response.json();

    return {
      populatedProjectors: data.populatedProjectors || [],
      pagination: data.pagination || {},
    };
  }

  // Get tools (no pagination, updated endpoint)
  async getTools(
    filters?: SearchFilterParams
  ): Promise<{ populatedTools: Tool[]; total: number }> {
    const params: ApiParams = {};
    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;
    if (filters?.manufacturer) params.manufacturer = filters.manufacturer;
    if (filters?.type) params.type = filters.type;
    if (filters?.releaseYear) params.releaseYear = filters.releaseYear;

    const queryString = new URLSearchParams(params as any).toString();
    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/tools?${queryString}`);
    const data = await response.json();

    return {
      populatedTools: data.populatedTools || [],
      total: data.populatedTools?.length || 0,
    };
  }

  // Get phones with pagination and filters (new device type)
  async getPhones(
    page: number = 1,
    limit: number = 20,
    filters?: SearchFilterParams
  ): Promise<{ populatedPhones: Phone[]; pagination: PaginationState }> {
    const params: ApiParams = { page, limit };
    if (filters?.search) params.search = filters.search;
    if (filters?.status) params.status = filters.status;
    if (filters?.manufacturer) params.manufacturer = filters.manufacturer;
    if (filters?.type) params.type = filters.type;
    if (filters?.releaseYear) params.releaseYear = filters.releaseYear;

    const queryString = new URLSearchParams(params as any).toString();
    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/phones?${queryString}`);
    const data = await response.json();

    return {
      populatedPhones: data.populatedPhones || [],
      pagination: data.pagination || {},
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
      const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/${deviceType}s/filters`);
      const data = await response.json();
      return data;
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
      const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/${deviceType}s/${id}`);
      const data = await response.json();
      return data;
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
    const response = await this.makeApiCall(
      `${INVENTORY_API_BASE_URL}/api/inventory/${deviceType}s`,
      {
        method: 'POST',
        body: JSON.stringify(deviceData),
      }
    );
    const data = await response.json();
    return data;
  }

  // Get device statistics
  async getDeviceStatistics(deviceType: DeviceType): Promise<{
    total: number;
    active: number;
    standby: number;
    broken: number;
  }> {
    try {
      const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/${deviceType}s/statistics`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching device statistics:', error);
      return { total: 0, active: 0, standby: 0, broken: 0 };
    }
  }

  // Get device activities
  async getDeviceActivities(deviceType: DeviceType, deviceId: string): Promise<any[]> {
    try {
      const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/activity/${deviceType}/${deviceId}`);
      const data = await response.json();
      return data || [];
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

    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/activity`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data;
  }

  // Get device inspections
  async getDeviceInspections(deviceType: DeviceType, deviceId: string): Promise<any[]> {
    try {
      const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/inspect`, {
        method: 'GET',
      });
      const data = await response.json();
      return data.data?.filter((inspection: any) => inspection.deviceId === deviceId) || [];
    } catch (error) {
      console.error('Error fetching device inspections:', error);
      return [];
    }
  }

  // Get inspection by ID
  async getInspectionById(inspectionId: string): Promise<any> {
    try {
      const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/inspect/${inspectionId}`);
      const data = await response.json();
      return data;
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
    const payload = {
      deviceId,
      deviceType,
      inspectionType: inspectionData.inspectionType,
      scheduledDate: inspectionData.scheduledDate,
      notes: inspectionData.notes || '',
    };

    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/inspect`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data;
  }

  // Update device inspection
  async updateDeviceInspection(inspectionId: string, updateData: any): Promise<any> {
    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/inspect/${inspectionId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });

    const data = await response.json();
    return data;
  }

  // Assign device to user
  async assignDevice(
    deviceType: DeviceType,
    deviceId: string,
    userId: string,
    userName?: string,
    reason?: string
  ): Promise<any> {
    // Backend expects userId field for new user assignment
    // Also send userName for display purposes
    const payload: any = { userId };
    if (userName) payload.userName = userName;
    if (reason) payload.reason = reason;

    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/${deviceType}s/${deviceId}/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data;
  }

  // Revoke device from user
  async revokeDevice(
    deviceType: DeviceType,
    deviceId: string,
    reasons: string[],
    status: string = 'Standby'
  ): Promise<any> {
    const payload = { reasons, status };

    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/${deviceType}s/${deviceId}/revoke`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data;
  }

  // Update device status
  async updateDeviceStatus(
    deviceType: DeviceType,
    deviceId: string,
    status: string,
    brokenReason?: string,
    brokenDescription?: string
  ): Promise<any> {
    const payload: any = { status };
    if (brokenReason) payload.brokenReason = brokenReason;
    if (brokenDescription) payload.brokenDescription = brokenDescription;

    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/${deviceType}s/${deviceId}/status`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data;
  }

  // Get all rooms
  async getAllRooms(): Promise<any[]> {
    try {
      const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/rooms`);
      const data = await response.json();
      return data.rooms || data.data || [];
    } catch (error) {
      console.error('Error fetching rooms:', error);
      return [];
    }
  }

  // Assign device to room
  async assignDeviceToRoom(deviceType: DeviceType, deviceId: string, roomId: string): Promise<any> {
    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/${deviceType}s/${deviceId}`, {
      method: 'PUT',
      body: JSON.stringify({ room: roomId }),
    });

    const data = await response.json();
    return data;
  }

  // Delete/Dispose device
  async deleteDevice(deviceType: DeviceType, deviceId: string): Promise<any> {
    const response = await this.makeApiCall(`${INVENTORY_API_BASE_URL}/api/inventory/${deviceType}s/${deviceId}`, {
      method: 'DELETE',
    });

    const data = await response.json();
    return data;
  }

  // Get users for assignment with pagination and search
  async getUsers(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<{ users: any[]; pagination: { page: number; limit: number; total: number; hasNext: boolean } }> {
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (search && search.trim()) {
        params.append('search', search.trim());
      }

      const url = `${INVENTORY_API_BASE_URL}/api/inventory/user?${params.toString()}`;
      const response = await this.makeApiCall(url);
      const data = await response.json();

      // Handle different response formats
      const users = data.users || data.data || data || [];
      const total = data.pagination?.total || data.total || users.length;
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
    const result = await this.getDevicesByType(deviceType, {}, { page, limit, total: 0, hasNext: false, hasPrev: false, totalPages: 0, itemsPerPage: limit });
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
        const manuArray = Array.isArray(filter.manufacturer) ? filter.manufacturer : [filter.manufacturer];
        if (!device.manufacturer || !manuArray.some(m => 
          device.manufacturer?.toLowerCase().includes(m.toLowerCase())
        )) {
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
