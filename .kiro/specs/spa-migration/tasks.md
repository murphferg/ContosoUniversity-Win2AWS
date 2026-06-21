# Implementation Plan: SPA Migration

## Overview

Migrate the Contoso University application from ASP.NET MVC with Razor Views to a React SPA frontend backed by REST API controllers. The backend API controllers will be implemented in C# (.NET 8), and the React frontend will use TypeScript. The existing data layer (EF Core models, SchoolContext) remains unchanged. Implementation proceeds backend-first (DTOs, API controllers, middleware), then frontend (React app setup, shared utilities, page components), with testing integrated throughout.

## Tasks

- [x] 1. Set up backend API infrastructure
  - [x] 1.1 Create DTO record classes for all entities
    - Create a `DTOs/` folder under the project root
    - Add `StudentDtos.cs` with `StudentListItemDto`, `StudentDetailDto`, `EnrollmentDto`, `StudentCreateDto`, `StudentUpdateDto`
    - Add `CourseDtos.cs` with `CourseListItemDto`, `CourseDetailDto`, `CourseCreateDto`, `CourseUpdateDto`
    - Add `DepartmentDtos.cs` with `DepartmentListItemDto`, `DepartmentDetailDto`, `DepartmentCreateDto`, `DepartmentUpdateDto`, `DepartmentConflictDto`
    - Add `InstructorDtos.cs` with `InstructorListItemDto`, `CourseAssignmentDto`, `InstructorDetailDto`, `CourseEnrollmentDto`, `InstructorCreateDto`, `InstructorUpdateDto`
    - Add `StatisticsDtos.cs` with `EnrollmentStatDto`
    - Add `NotificationDtos.cs` with `NotificationListDto`, `NotificationItemDto`
    - Add `CommonDtos.cs` with `PaginatedResponse<T>`, `ValidationErrorResponse`
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 1.2 Create ApiExceptionMiddleware for global error handling
    - Implement middleware that catches unhandled exceptions on `/api` paths
    - Return 500 status with `{ "error": "An unexpected error occurred." }` JSON body
    - Let non-API exceptions pass through for the SPA fallback
    - Register the middleware in Program.cs before routing
    - _Requirements: 13.5, 5.3_

  - [x] 1.3 Configure SPA fallback and static file serving in Program.cs
    - Add `UseStaticFiles()` for wwwroot
    - Add SPA fallback middleware that returns `index.html` for non-API, non-static-file GET requests
    - Add development-mode proxy to React dev server
    - Return 502 if React dev server is unreachable in development mode
    - Ensure `/api` routes are evaluated before fallback
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 7.1, 7.4_

- [x] 2. Implement Students API controller
  - [x] 2.1 Implement StudentsApiController with full CRUD
    - Create `Controllers/Api/StudentsApiController.cs` with `[Route("api/students")]`
    - GET index: paginated, sorted, filtered by search string; default page size 10, default sort LastName ascending
    - GET by id: return student with enrollments
    - POST: validate, create student, send notification (fire-and-forget), return 201
    - PUT: validate, update student, send notification, return 200
    - DELETE: remove student, send notification, return 204
    - Return 404 for non-existent IDs, 400 for validation failures
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 2.2 Write property test: Pagination invariants
    - **Property 1: Pagination invariants**
    - **Validates: Requirements 1.1**

  - [ ]* 2.3 Write property test: Student CRUD round trip
    - **Property 2: Student CRUD round trip**
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 2.4 Write property test: Student validation rejection
    - **Property 3: Student validation rejection**
    - **Validates: Requirements 1.6, 13.3**

- [x] 3. Implement Courses API controller
  - [x] 3.1 Implement CoursesApiController with full CRUD and image upload
    - Create `Controllers/Api/CoursesApiController.cs` with `[Route("api/courses")]`
    - GET index: return all courses with department names
    - GET by id: return course details with department and image path
    - POST: validate, handle multipart image upload (validate type: jpg/jpeg/png/gif/bmp, max 5MB), create course, send notification, return 201
    - PUT: validate, handle image upload/replace, update course, send notification, return 200
    - DELETE: remove course, delete image file if exists, send notification, return 204
    - Return 404 for non-existent IDs, 400 for validation/file failures
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [ ]* 3.2 Write property test: Course CRUD round trip
    - **Property 4: Course CRUD round trip**
    - **Validates: Requirements 2.3, 2.6**

  - [ ]* 3.3 Write property test: Course file upload validation
    - **Property 5: Course file upload validation**
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 3.4 Write property test: Course validation rejection
    - **Property 6: Course validation rejection**
    - **Validates: Requirements 2.9, 13.3**

- [x] 4. Implement Departments API controller
  - [x] 4.1 Implement DepartmentsApiController with CRUD and concurrency handling
    - Create `Controllers/Api/DepartmentsApiController.cs` with `[Route("api/departments")]`
    - GET index: return all departments with administrator names
    - GET by id: return department details with RowVersion
    - POST: validate, create department, send notification, return 201
    - PUT: validate, check RowVersion for concurrency, update department, send notification, return 200; return 409 with conflict DTO if version mismatch
    - DELETE: remove department, send notification, return 204
    - Return 404 for non-existent IDs, 400 for validation failures
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [ ]* 4.2 Write property test: Department CRUD round trip
    - **Property 7: Department CRUD round trip**
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 4.3 Write property test: Department validation rejection
    - **Property 8: Department validation rejection**
    - **Validates: Requirements 3.8, 13.3**

- [x] 5. Implement Instructors API controller
  - [x] 5.1 Implement InstructorsApiController with CRUD and course/office assignments
    - Create `Controllers/Api/InstructorsApiController.cs` with `[Route("api/instructors")]`
    - GET index: return instructors ordered by LastName with office and course assignments
    - GET by id: return instructor details; if courseId param provided, include enrollments for that course
    - POST: validate, create instructor with course assignments and optional office, send notification, return 201
    - PUT: validate, update instructor, replace course assignments, update/remove office assignment, send notification, return 200
    - DELETE: remove instructor, null-out department references, send notification, return 204
    - Return 404 for non-existent IDs, 400 for validation failures
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [ ]* 5.2 Write property test: Instructor list ordering
    - **Property 9: Instructor list ordering**
    - **Validates: Requirements 4.1**

  - [ ]* 5.3 Write property test: Instructor CRUD round trip with course assignment replacement
    - **Property 10: Instructor CRUD round trip with course assignment replacement**
    - **Validates: Requirements 4.3, 4.4**

  - [ ]* 5.4 Write property test: Instructor validation rejection
    - **Property 11: Instructor validation rejection**
    - **Validates: Requirements 4.8, 13.3**

- [x] 6. Implement Statistics and Notifications API controllers
  - [x] 6.1 Implement StatisticsApiController
    - Create `Controllers/Api/StatisticsApiController.cs` with `[Route("api/statistics")]`
    - GET `/enrollment-stats`: return enrollment date groups sorted by date ascending, each with date and student count
    - Return 200 with empty array if no students exist
    - _Requirements: 5.1, 5.2_

  - [ ]* 6.2 Write property test: Statistics aggregation correctness
    - **Property 12: Statistics aggregation correctness**
    - **Validates: Requirements 5.1**

  - [x] 6.3 Implement NotificationsApiController
    - Create `Controllers/Api/NotificationsApiController.cs` with `[Route("api/notifications")]`
    - GET: return up to 10 most recent pending notifications and unread count
    - POST `/{id}/mark-read`: mark notification as read, return 200
    - Return 503 with message if notification microservice is unavailable
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 7. Checkpoint - Backend API verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Set up React frontend application
  - [x] 8.1 Initialize React TypeScript project in ClientApp directory
    - Create `ClientApp/` directory with React 18+ TypeScript project (using Vite or CRA)
    - Configure `package.json` with dependencies: react, react-dom, react-router-dom, typescript
    - Configure TypeScript (`tsconfig.json`) with strict mode
    - Set up proxy configuration for development to forward API requests to the ASP.NET backend
    - _Requirements: 7.1, 7.2_

  - [x] 8.2 Create shared TypeScript types and API client utility
    - Create `ClientApp/src/types.ts` with all TypeScript interfaces matching backend DTOs
    - Create `ClientApp/src/apiClient.ts` with centralized fetch wrapper, error handling, JSON parsing, `ApiError` class
    - Create `ClientApp/src/hooks/useApi.ts` custom hook for data fetching with loading/error state
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 8.3 Create shared React UI components
    - Create `ClientApp/src/components/Pagination.tsx` for reusable pagination controls
    - Create `ClientApp/src/components/FormField.tsx` for form fields with validation error display
    - Create `ClientApp/src/components/ConfirmDelete.tsx` for delete confirmation pattern
    - Create `ClientApp/src/components/ErrorMessage.tsx` for error display
    - _Requirements: 8.6, 8.10, 9.4, 10.6_

  - [x] 8.4 Set up React Router and Layout with navigation bar
    - Create `ClientApp/src/App.tsx` with React Router configuration for all routes
    - Create `ClientApp/src/components/Layout.tsx` with navigation bar containing links to Home, About, Students, Courses, Instructors, Departments
    - Create `ClientApp/src/pages/HomePage.tsx` and `ClientApp/src/pages/NotFoundPage.tsx`
    - Configure route fallback to NotFoundPage for unmatched routes
    - _Requirements: 7.2, 7.3, 7.4, 7.5_

- [x] 9. Implement Student Management UI
  - [x] 9.1 Implement Student list page with search, sort, and pagination
    - Create `ClientApp/src/pages/students/StudentList.tsx`
    - Display paginated table with Last Name, First Name, Enrollment Date columns (10 per page, default sort LastName ascending)
    - Implement search field that filters by name and resets to page 1
    - Implement column header click to sort ascending/descending toggle
    - Implement pagination controls using shared Pagination component
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 9.2 Implement Student create, edit, details, and delete pages
    - Create `ClientApp/src/pages/students/StudentCreate.tsx` with form (LastName max 50, FirstMidName max 50, EnrollmentDate)
    - Create `ClientApp/src/pages/students/StudentEdit.tsx` pre-populated with existing data
    - Create `ClientApp/src/pages/students/StudentDetails.tsx` showing enrollments and grades
    - Create `ClientApp/src/pages/students/StudentDelete.tsx` with confirmation view
    - Display validation errors next to fields; non-field errors at top of form
    - Preserve form data on server error; navigate to list on success
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_

- [x] 10. Implement Course Management UI
  - [x] 10.1 Implement Course list, create, edit, details, and delete pages
    - Create `ClientApp/src/pages/courses/CourseList.tsx` with table (Number, Title, Credits, Department)
    - Create `ClientApp/src/pages/courses/CourseCreate.tsx` with form including file input for image and department dropdown
    - Create `ClientApp/src/pages/courses/CourseEdit.tsx` pre-populated, showing current image filename
    - Create `ClientApp/src/pages/courses/CourseDetails.tsx` rendering image if present
    - Create `ClientApp/src/pages/courses/CourseDelete.tsx` with confirmation
    - Upload images as multipart form data
    - Display validation errors adjacent to fields; preserve user data on error
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

- [x] 11. Implement Department Management UI
  - [x] 11.1 Implement Department list, create, edit, and delete pages with concurrency handling
    - Create `ClientApp/src/pages/departments/DepartmentList.tsx` with table (Name, Budget, Start Date, Administrator) sorted by Name ascending
    - Create `ClientApp/src/pages/departments/DepartmentCreate.tsx` with form and instructor dropdown for administrator
    - Create `ClientApp/src/pages/departments/DepartmentEdit.tsx` with concurrency conflict resolution UI (show current vs submitted values, Retry and Cancel buttons)
    - Create `ClientApp/src/pages/departments/DepartmentDelete.tsx` with confirmation showing Name, Budget, Start Date, Administrator, plus Confirm and Cancel buttons
    - Navigate to list on success within 1 second; show error with Retry button on load failure
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 12. Implement Instructor Management UI
  - [x] 12.1 Implement Instructor list page with course/enrollment drill-down
    - Create `ClientApp/src/pages/instructors/InstructorList.tsx` with table (Last Name, First Name, Hire Date, Office, Courses) sorted by Last Name ascending
    - Show empty state message when no instructors exist
    - On instructor row click, display courses taught in a section below the table
    - On course click, display enrollments (student name + grade, "No grade" for null)
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 12.2 Implement Instructor create, edit, and delete pages
    - Create `ClientApp/src/pages/instructors/InstructorCreate.tsx` with form: LastName (max 50), FirstMidName (max 50), HireDate, optional office location (max 50), checkbox list of all courses
    - Create `ClientApp/src/pages/instructors/InstructorEdit.tsx` with pre-checked courses and pre-filled fields
    - Create `ClientApp/src/pages/instructors/InstructorDelete.tsx` with confirmation showing name, hire date, office
    - Client-side validation before submit; display errors next to invalid fields and prevent submission
    - _Requirements: 11.5, 11.6, 11.7, 11.8, 11.9_

- [x] 13. Implement About page and Notification UI
  - [x] 13.1 Implement About page with enrollment statistics
    - Create `ClientApp/src/pages/AboutPage.tsx`
    - Fetch from Statistics_API and display enrollment date groups in a table
    - Handle empty state and error state
    - _Requirements: 5.1, 5.2_

  - [x] 13.2 Implement Notification bell and dropdown in NavBar
    - Add notification indicator to navigation bar showing unread count (display "99+" when count > 99)
    - On click, display dropdown with up to 10 recent notifications ordered by timestamp descending (entity type, operation, timestamp)
    - On notification click, mark as read and update unread count
    - Poll Notification_API every 5 seconds; retain last known count on failure
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 13.3 Write property test: Notification count display
    - **Property 13: Notification count display**
    - **Validates: Requirements 12.1**

- [x] 14. Checkpoint - Frontend verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. API response conventions and final integration
  - [x] 15.1 Verify and enforce API response structure conventions across all controllers
    - Audit all controllers: GET/PUT return 200, POST returns 201, DELETE returns 204
    - Ensure all JSON responses have `Content-Type: application/json` header
    - Ensure DELETE responses have no body
    - Ensure 400 responses use field-name-to-error-array dictionary format
    - Ensure 404 responses include descriptive error messages
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 15.2 Write property test: API response structure conventions
    - **Property 14: API response structure conventions**
    - **Validates: Requirements 13.1, 13.2, 13.6**

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use FsCheck for .NET and validate universal correctness properties from the design
- Unit tests validate specific examples and edge cases
- The existing EF Core data layer (models, SchoolContext, PaginatedList) remains unchanged
- Backend property tests should be placed in `tests/Api/Properties/` directory
- Frontend component tests should use React Testing Library with mocked API responses
- The notification service integration uses the existing `NotificationClient` with fire-and-forget pattern

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "8.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "8.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "4.1", "5.1", "6.1", "6.3", "8.3", "8.4"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "3.2", "3.3", "3.4", "4.2", "4.3", "5.2", "5.3", "5.4", "6.2", "9.1", "10.1", "11.1", "13.1"] },
    { "id": 4, "tasks": ["9.2", "12.1", "13.2"] },
    { "id": 5, "tasks": ["12.2", "13.3", "15.1"] },
    { "id": 6, "tasks": ["15.2"] }
  ]
}
```
