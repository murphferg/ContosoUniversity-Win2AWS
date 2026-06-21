// TypeScript interfaces matching backend C# DTOs

// --- Common ---

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  totalPages: number;
}

export interface ValidationErrorResponse {
  errors: Record<string, string[]>;
}

// --- Students ---

export interface StudentListItem {
  id: number;
  lastName: string;
  firstMidName: string;
  enrollmentDate: string;
}

export interface StudentDetail {
  id: number;
  lastName: string;
  firstMidName: string;
  enrollmentDate: string;
  enrollments: Enrollment[];
}

export interface Enrollment {
  enrollmentId: number;
  courseTitle: string;
  courseId: number;
  grade: string | null;
}

export interface StudentCreateDto {
  lastName: string;
  firstMidName: string;
  enrollmentDate: string;
}

export interface StudentUpdateDto {
  id: number;
  lastName: string;
  firstMidName: string;
  enrollmentDate: string;
}

// --- Courses ---

export interface CourseListItem {
  courseId: number;
  title: string;
  credits: number;
  departmentName: string;
}

export interface CourseDetail {
  courseId: number;
  title: string;
  credits: number;
  departmentId: number;
  departmentName: string;
  teachingMaterialImagePath: string | null;
}

export interface CourseCreateDto {
  courseId: number;
  title: string;
  credits: number;
  departmentId: number;
}

export interface CourseUpdateDto {
  title: string;
  credits: number;
  departmentId: number;
}

// --- Departments ---

export interface DepartmentListItem {
  departmentId: number;
  name: string;
  budget: number;
  startDate: string;
  administratorName: string | null;
}

export interface DepartmentDetail {
  departmentId: number;
  name: string;
  budget: number;
  startDate: string;
  instructorId: number | null;
  rowVersion: string; // Base64-encoded byte[]
}

export interface DepartmentCreateDto {
  name: string;
  budget: number;
  startDate: string;
  instructorId: number | null;
}

export interface DepartmentUpdateDto {
  name: string;
  budget: number;
  startDate: string;
  instructorId: number | null;
  rowVersion: string;
}

export interface DepartmentConflict {
  currentName: string;
  currentBudget: number;
  currentStartDate: string;
  currentAdministratorName: string | null;
  currentRowVersion: string;
}

// --- Instructors ---

export interface InstructorListItem {
  id: number;
  lastName: string;
  firstMidName: string;
  hireDate: string;
  officeLocation: string | null;
  courses: CourseAssignment[];
}

export interface CourseAssignment {
  courseId: number;
  title: string;
  departmentName: string;
}

export interface InstructorDetail {
  id: number;
  lastName: string;
  firstMidName: string;
  hireDate: string;
  officeLocation: string | null;
  courses: CourseAssignment[];
  selectedCourseEnrollments: CourseEnrollment[] | null;
}

export interface CourseEnrollment {
  studentName: string;
  grade: string | null;
}

export interface InstructorCreateDto {
  lastName: string;
  firstMidName: string;
  hireDate: string;
  officeLocation: string | null;
  selectedCourseIds: number[];
}

export interface InstructorUpdateDto {
  lastName: string;
  firstMidName: string;
  hireDate: string;
  officeLocation: string | null;
  selectedCourseIds: number[];
}

// --- Statistics ---

export interface EnrollmentStat {
  enrollmentDate: string;
  studentCount: number;
}

// --- Notifications ---

export interface NotificationList {
  notifications: NotificationItem[];
  unreadCount: number;
}

export interface NotificationItem {
  id: number;
  entityType: string;
  operation: string;
  entityDisplayName: string | null;
  timestamp: string;
}
