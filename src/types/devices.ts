// User interface matching inventory service
export interface User {
  _id: string;
  fullname: string;
  fullName?: string; // backward compatibility
  name?: string; // backward compatibility
  jobTitle?: string;
  job_title?: string; // backward compatibility
  designation?: string; // backward compatibility
  department?: string;
  email?: string;
  avatarUrl?: string;
}

// Room interface matching inventory service
export interface Room {
  _id: string;
  name: string;
  room_name?: string;
  short_title?: string;
  location?:
    | {
        building: string;
        floor: string;
      }[]
    | string[];
  status?: string;
  building?:
    | {
        name: string;
      }
    | string;
  room_type?:
    | 'classroom_room'
    | 'meeting_room'
    | 'auditorium'
    | 'office'
    | 'function_room'
    | 'outdoor';
  capacity?: number;
}

// Location detail for rooms
export interface LocationDetail {
  building: string;
  floor: string;
}

// Current holder (denormalized data from inventory service)
export interface CurrentHolder {
  id: string;
  fullname: string;
  jobTitle?: string;
  department?: string;
  avatarUrl?: string;
}

// Device specs interface
export interface DeviceSpecs {
  processor?: string;
  ram?: string;
  storage?: string;
  display?: string;
  resolution?: string;
  size?: string;
  ip?: string; // for printers
  imei1?: string; // for phones
  imei2?: string; // for phones
  phoneNumber?: string; // for phones
  [key: string]: any;
}

// Assignment history interface matching inventory service
export interface AssignmentHistory {
  _id?: string;
  user?: User;
  userName?: string; // DEPRECATED: Use fullnameSnapshot instead
  fullnameSnapshot?: string; // Snapshot of user's fullname at assignment time
  fullname?: string; // Computed field added by backend helper
  jobTitle?: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  assignedBy?: User;
  revokedBy?: User;
  revokedReason?: string[];
  document?: string;
}

// Base device interface matching inventory service
export interface BaseDevice {
  _id: string;
  name: string;
  manufacturer?: string;
  serial: string;
  releaseYear?: number;
  assigned?: User[];
  assignmentHistory?: AssignmentHistory[];
  room?: Room;
  status: 'Active' | 'Standby' | 'Broken' | 'PendingDocumentation';
  brokenReason?: string;
  brokenDescription?: string;
  reason?: string; // backward compatibility
  specs?: DeviceSpecs;
  currentHolder?: CurrentHolder; // Denormalized data
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Specific device interfaces
export interface Laptop extends BaseDevice {
  type: 'Laptop' | 'Desktop';
}

export interface Monitor extends BaseDevice {
  type?: 'Monitor'; // Optional for backward compatibility
}

export interface Printer extends BaseDevice {
  type?: 'Printer'; // Optional for backward compatibility
}

export interface Projector extends BaseDevice {
  type?: 'Projector'; // Optional for backward compatibility
}

export interface Tool extends BaseDevice {
  type?: 'Tool'; // Optional for backward compatibility
}

export interface Phone extends BaseDevice {
  type?: 'Phone'; // Optional for backward compatibility
  imei1?: string;
  imei2?: string;
  phoneNumber?: string;
}

export type Device = Laptop | Monitor | Printer | Projector | Tool | Phone;

export type DeviceType = 'laptop' | 'monitor' | 'printer' | 'projector' | 'tool' | 'phone';

// API response interfaces matching inventory service
export interface DevicesResponse {
  populatedLaptops?: Laptop[];
  populatedMonitors?: Monitor[];
  populatedPrinters?: Printer[];
  populatedProjectors?: Projector[];
  populatedTools?: Tool[];
  populatedPhones?: Phone[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Filter interfaces
export interface DeviceFilter {
  search?: string;
  status?: string[];
  manufacturer?: string[];
  room?: string;
  assigned?: boolean;
  type?: string[];
  releaseYear?: number;
  departments?: string[];
  yearRange?: number[];
}

// Filter options from API
export interface DeviceFilterOptions {
  statuses: string[];
  types: string[];
  manufacturers: string[];
  departments: string[];
  yearRange: [number, number];
}

// Activity interfaces
export interface DeviceActivity {
  _id: string;
  entityType: DeviceType;
  entityId: string;
  type: 'repair' | 'update' | 'maintenance' | 'software';
  description: string;
  details?: string;
  date: string;
  updatedBy: string;
}

// Inspection interfaces
export interface DeviceInspection {
  _id: string;
  deviceId: string;
  deviceType: DeviceType;
  inspectorId: string;
  inspectionDate: string;
  inspectionType: string;
  scheduledDate?: string;
  results?: {
    externalCondition?: {
      overallCondition?: string;
      notes?: string;
    };
    cpu?: {
      performance?: string;
      temperature?: string;
      overallCondition?: string;
      notes?: string;
    };
    ram?: {
      consumption?: string;
      overallCondition?: string;
      notes?: string;
    };
    storage?: {
      remainingCapacity?: string;
      overallCondition?: string;
      notes?: string;
    };
    battery?: {
      capacity?: string;
      performance?: string;
      chargeCycles?: string;
      overallCondition?: string;
      notes?: string;
    };
    display?: {
      colorAndBrightness?: string;
      overallCondition?: string;
      notes?: string;
    };
    connectivity?: {
      overallCondition?: string;
      notes?: string;
    };
    software?: {
      overallCondition?: string;
      notes?: string;
    };
    [key: string]: any;
  };
  overallAssessment?: string;
  passed?: boolean;
  recommendations?: string;
  technicalConclusion?: string;
  followUpRecommendation?: string;
  notes?: string;
  report?: string; // PDF report URL
}

// Device statistics
export interface DeviceStatistics {
  total: number;
  active: number;
  standby: number;
  broken: number;
}

// Document generation interfaces
export interface DocumentGenerationData {
  device: Device;
  currentUser: User;
  assignedUser?: User;
  inspector?: User;
  inspection?: DeviceInspection;
}
