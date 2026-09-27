export type Role = 'doctor' | 'mr' | 'receptionist';

export interface AdminUser {
  id: string;
  role: 'admin';
  name: string;
  email?: string;
  mustChangePassword?: boolean;
}

export type Permission =
  | 'dashboard'
  | 'users'
  | 'access'
  | 'appointments'
  | 'conferences'
  | 'billing'
  | 'tickets'
  | 'faqs'
  | 'content'
  | 'settings'
  | 'reports'
  | 'audit';

export interface AdminAccess {
  isSuper: boolean;
  roleName: string | null;
  permissions: Permission[];
}

export interface AdminRoleRow {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSuper: boolean;
  isSystem: boolean;
  members: number;
}

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  role: { id: string | null; name: string; isSuper: boolean };
  permissions: Permission[];
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  isSelf: boolean;
}

export interface ReportResult {
  type: string;
  title: string;
  from: string;
  to: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
  truncated: boolean;
}

export interface ReportFilters {
  reports: { type: string; title: string }[];
  companies: string[];
  mrs: Person[];
  doctors: Person[];
  specialties: string[];
  cities: string[];
}

export interface Person {
  id: string;
  name: string;
  mobile?: string;
  role?: string;
}

export interface Dashboard {
  users: { doctor: number; mr: number; receptionist: number; inactive: number; deleted: number };
  newUsersLast7Days: number;
  appointmentsToday: Partial<Record<'pending' | 'approved' | 'completed' | 'cancelled', number>>;
  upcomingNext7Days: number;
  openTickets: number;
  pendingAccessRequests: number;
  activeSubscriptions: number;
  revenueLast30Days: { paise: number; orders: number };
  appointmentTrend: { date: string; appointments: number }[];
}

export interface UserRow {
  id: string;
  role: Role;
  name: string;
  mobile?: string;
  email?: string;
  status: 'active' | 'inactive' | 'deleted';
  code?: string;
  detail?: string | null;
  onboarded: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface UserDetail {
  user: UserRow & { onboarding: { profile: boolean; final: boolean } };
  profile: Record<string, unknown> | null;
  subscription: { plan: { name: string; period: string }; endsAt: string | null } | null;
  access: { id: string; status: string; permissions: string[]; with: Person | null }[];
  appointments: Record<string, number>;
}

export interface AccessRow {
  id: string;
  doctor: Person | null;
  receptionist: Person | null;
  status: 'pending' | 'active' | 'inactive';
  permissions: string[];
  requestedAt?: string;
  grantedAt?: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  doctor: { id: string; name: string; specialty?: string; clinicName?: string };
  mr: Person | null;
  visitor: { name: string; company?: string; division?: string };
  startAt: string;
  date: string;
  timeLabel: string;
  status: 'pending' | 'approved' | 'cancelled' | 'completed';
  purpose?: string;
  createdBy?: string;
  cancel?: { role: string; reason?: string };
  can: { approve: boolean; reject: boolean; complete: boolean; reschedule: boolean; cancel: boolean };
}

export interface Conference {
  id: string;
  title: string;
  organizer?: string;
  startDate: string;
  endDate: string;
  venue?: string;
  city?: string;
  specialty?: string;
  logoUrl?: string;
  website?: string;
  description?: string;
  status: 'draft' | 'published' | 'cancelled';
  participants?: { planning: number; registered: number; more_info: number };
}

export interface Plan {
  id: string;
  code: string;
  role: Role;
  name: string;
  period: 'monthly' | 'yearly' | 'lifetime';
  pricePaise: number;
  mrpPaise: number | null;
  taxPercent: number;
  features: string[];
  active: boolean;
  sort: number;
  activeSubscribers: number;
}

export interface Order {
  id: string;
  number: string;
  user: Person | null;
  plan: { code: string; name: string } | null;
  amountPaise: number;
  method: string;
  provider: string;
  status: 'created' | 'paid' | 'failed' | 'expired';
  failureReason?: string;
  paidAt?: string;
  createdAt: string;
}

export interface SubscriptionRow {
  id: string;
  user: Person | null;
  plan: { code: string; name: string; period: string };
  startsAt: string;
  endsAt: string | null;
  active: boolean;
}

export interface Ticket {
  id: string;
  number: string;
  category: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  role?: Role;
  user?: Person;
  assignedTo?: { id: string; name?: string } | null;
  replyCount: number;
  createdAt: string;
  replies?: { role: string; message: string; at: string; fromSupport: boolean }[];
}

export interface Faq {
  id: string;
  audience: 'all' | Role;
  question: string;
  answer: string;
  sort: number;
  active: boolean;
}

export interface ContentPage {
  key: string;
  title: string;
  effectiveDate: string;
  intro?: string;
  sections: { title: string; body?: string; points: string[] }[];
  version: number;
  updatedAt?: string;
}

export interface SupportSettings {
  topics: string[];
  whatsapp: string | null;
  emails: { mr: string; doctor: string; receptionist: string };
}

export interface AuditRow {
  id: string;
  at: string;
  actor: { id?: string; name?: string; role?: string; contact?: string };
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}
