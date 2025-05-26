export interface User {
  _id: string;
  fullname: string;
  jobTitle?: string;
  department?: string;
  avatarUrl?: string;
}

export interface Room {
  _id: string;
  name: string;
  location: string[];
  status?: string;
}

export interface DeviceSpecs {
  processor?: string;
  ram?: string;
  storage?: string;
  display?: string;
  resolution?: string;
  size?: string;
  [key: string]: any;
}

export interface AssignmentHistory {
  _id: string;
  user: User;
  userName?: string;
  jobTitle?: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  assignedBy: User;
  revokedBy?: User;
  revokedReason?: string[];
  document?: string;
}

export interface BaseDevice {
  _id: string;
  name: string;
  manufacturer?: string;
  serial: string;
  releaseYear?: number;
  assigned: User[];
  assignmentHistory: AssignmentHistory[];
  room?: Room;
  status: 'Active' | 'Standby' | 'Broken' | 'PendingDocumentation';
  reason?: string;
  specs: DeviceSpecs;
  createdAt: string;
  updatedAt: string;
}

export interface Laptop extends BaseDevice {
  type: 'Laptop' | 'Desktop';
}

export interface Monitor extends BaseDevice {
  type: 'Monitor';
}

export interface Printer extends BaseDevice {
  type: 'Printer';
}

export interface Projector extends BaseDevice {
  type: 'Projector';
}

export interface Tool extends BaseDevice {
  type: 'Tool';
}

export type Device = Laptop | Monitor | Printer | Projector | Tool;

export type DeviceType = 'laptop' | 'monitor' | 'printer' | 'projector' | 'tool';

export interface DevicesResponse {
  populatedLaptops?: Laptop[];
  populatedMonitors?: Monitor[];
  populatedPrinters?: Printer[];
  populatedProjectors?: Projector[];
  populatedTools?: Tool[];
}

export interface DeviceFilter {
  search?: string;
  status?: string;
  manufacturer?: string;
  room?: string;
  assigned?: boolean;
} 