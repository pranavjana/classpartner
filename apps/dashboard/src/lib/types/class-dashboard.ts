export type ClassScheduleEntry = {
  day: number; // 0 = Sunday
  start: string; // HH:MM
  end: string; // HH:MM
};

export type ClassMetadata = {
  instructor?: string;
  meetLink?: string;
  schedule?: ClassScheduleEntry[];
  defaultLanguage?: string;
};

export type ClassDetail = {
  id: string;
  name: string;
  code?: string;
  icon?: string;
  colour?: string;
  semester?: string;
  createdAt: string;
  updatedAt: string;
  pinned?: boolean;
  metadata?: ClassMetadata;
};

export type SessionStatus = "processing" | "ready" | "failed";

export type Session = {
  id: string;
  classId: string;
  title: string;
  date: string;
  durationMinutes: number;
  status: SessionStatus;
  lastEditedAt: string;
  wordCount?: number;
};

export type ClassStats = {
  totalMinutes: number;
  sessionCount: number;
  avgSessionMinutes: number;
  lastSessionAt?: string;
  weeklyTimeSeries: Array<{ date: string; minutes: number }>;
};

export type Note = {
  id: string;
  classId: string;
  title: string;
  createdAt: string;
  pinned?: boolean;
};

export type Permissions = {
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
};

export type ClassDashboardDetail = {
  classInfo: ClassDetail;
  stats: ClassStats;
  sessions: Session[];
  notes: Note[];
  permissions: Permissions;
};
