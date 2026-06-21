# Requirements Document

## Introduction

This document defines the requirements for migrating the Contoso University application from an ASP.NET MVC architecture with Razor Views to a modern Single Page Application (SPA) architecture. The frontend will be built with React and the backend will expose REST API controllers. The migration preserves all existing functionality (Students, Courses, Departments, Instructors, Home/About statistics, and Notifications) while delivering a responsive, client-side rendered user experience.

## Glossary

- **API_Controller**: An ASP.NET Core controller that returns JSON responses and follows RESTful conventions, replacing the existing MVC controllers that return Razor Views
- **React_Frontend**: A client-side Single Page Application built with React that communicates with the API_Controllers via HTTP requests
- **SPA_Shell**: The single HTML page served by the backend that bootstraps the React_Frontend application
- **Student_API**: The REST API endpoint group responsible for student CRUD operations and search/sort/pagination
- **Course_API**: The REST API endpoint group responsible for course CRUD operations including teaching material image uploads
- **Department_API**: The REST API endpoint group responsible for department CRUD operations with concurrency handling
- **Instructor_API**: The REST API endpoint group responsible for instructor CRUD operations including course assignments and office assignments
- **Statistics_API**: The REST API endpoint that provides enrollment date group statistics (About page data)
- **Notification_API**: The REST API endpoint group responsible for retrieving and managing notifications
- **Router**: The client-side routing mechanism in the React_Frontend that maps URL paths to page components without full-page reloads
- **API_Response**: A standardized JSON response envelope returned by all API_Controllers

## Requirements

### Requirement 1: REST API for Student Management

**User Story:** As a university administrator, I want to manage students through a REST API, so that the React frontend can perform all student operations without page reloads.

#### Acceptance Criteria

1. WHEN a GET request is sent to the Student_API index endpoint with optional sort, filter, and page parameters, THE Student_API SHALL return a paginated JSON response containing matching student records (LastName, FirstMidName, EnrollmentDate), total count, current page number, and total pages, with a default page size of 10 records, sorted by LastName ascending when no sort parameter is provided
2. WHEN a GET request is sent to the Student_API with a valid student ID, THE Student_API SHALL return the student details including associated enrollments and course information as JSON
3. WHEN a POST request with valid student data (LastName max 50 characters, FirstMidName max 50 characters, EnrollmentDate between 1753-01-01 and 9999-12-31) is sent to the Student_API, THE Student_API SHALL create the student record, send a notification via the Notification service, and return the created student as JSON with a 201 status code
4. WHEN a PUT request with valid student data is sent to the Student_API, THE Student_API SHALL update the student record, send a notification, and return the updated student as JSON
5. WHEN a DELETE request with a valid student ID is sent to the Student_API, THE Student_API SHALL remove the student record, send a notification, and return a 204 status code
6. IF a POST or PUT request contains invalid student data (missing required fields, LastName or FirstMidName exceeding 50 characters, or EnrollmentDate outside 1753-01-01 to 9999-12-31), THEN THE Student_API SHALL return a 400 status code with validation error details in the API_Response format indicating which fields failed
7. IF a GET, PUT, or DELETE request references a non-existent student ID, THEN THE Student_API SHALL return a 404 status code
8. IF the notification service is unavailable when a create, update, or delete operation succeeds, THEN THE Student_API SHALL complete the operation successfully and return the normal response without failing

### Requirement 2: REST API for Course Management

**User Story:** As a university administrator, I want to manage courses through a REST API, so that the React frontend can perform all course operations including image uploads.

#### Acceptance Criteria

1. WHEN a GET request is sent to the Course_API index endpoint, THE Course_API SHALL return a JSON array of all courses with their associated department names
2. WHEN a GET request is sent to the Course_API with a valid course ID, THE Course_API SHALL return the course details including department information as JSON
3. WHEN a POST request with valid course data (Title between 3 and 50 characters, Credits between 0 and 5, and an existing DepartmentID) is sent to the Course_API, THE Course_API SHALL create the course record, send a notification, and return the created course as JSON with a 201 status code
4. WHEN a POST or PUT request includes a teaching material image file, THE Course_API SHALL validate the file type (jpg, jpeg, png, gif, bmp) and size (maximum 5MB), store the image, and associate the path with the course record
5. IF a teaching material image file has an invalid type or exceeds 5MB, THEN THE Course_API SHALL return a 400 status code with a validation error message indicating the reason for rejection (invalid file type or size exceeded)
6. WHEN a PUT request with valid course data (Title between 3 and 50 characters, Credits between 0 and 5, and an existing DepartmentID) is sent to the Course_API with a valid course ID, THE Course_API SHALL update the course record, send a notification, and return the updated course as JSON
7. WHEN a DELETE request with a valid course ID is sent to the Course_API, THE Course_API SHALL remove the course record, delete any associated teaching material image file, send a notification, and return a 204 status code
8. IF a GET, PUT, or DELETE request references a non-existent course ID, THEN THE Course_API SHALL return a 404 status code
9. IF a POST or PUT request contains course data that fails validation (missing required fields, Title outside 3-50 characters, Credits outside 0-5, or non-existent DepartmentID), THEN THE Course_API SHALL return a 400 status code with a validation error message indicating which fields failed
10. IF the notification service is unavailable when a course is created, updated, or deleted, THEN THE Course_API SHALL still complete the course operation successfully and return the expected response

### Requirement 3: REST API for Department Management

**User Story:** As a university administrator, I want to manage departments through a REST API, so that the React frontend can perform all department operations with concurrency conflict detection.

#### Acceptance Criteria

1. WHEN a GET request is sent to the Department_API index endpoint, THE Department_API SHALL return a JSON array of all departments, where each entry includes the department ID, name, budget, start date, and administrator full name
2. WHEN a GET request is sent to the Department_API with a valid department ID, THE Department_API SHALL return the department details including the department ID, name, budget, start date, instructor ID, and RowVersion token as JSON
3. WHEN a POST request with valid department data is sent to the Department_API, THE Department_API SHALL create the department record, send a notification, and return the created department as JSON with a 201 status code
4. WHEN a PUT request with valid department data and a matching RowVersion is sent to the Department_API, THE Department_API SHALL update the department record, send a notification, and return the updated department as JSON
5. IF a PUT request contains a RowVersion that does not match the current database value, THEN THE Department_API SHALL return a 409 status code with the current database values for name, budget, start date, and administrator to support conflict resolution
6. WHEN a DELETE request with a valid department ID is sent to the Department_API, THE Department_API SHALL remove the department record, send a notification, and return a 204 status code
7. IF a request references a non-existent department ID, THEN THE Department_API SHALL return a 404 status code
8. IF a POST or PUT request contains invalid department data, THEN THE Department_API SHALL return a 400 status code with error messages indicating which fields failed validation, where valid department data requires a name between 3 and 50 characters, a budget as a decimal value, and a start date in date format
9. IF the notification service is unavailable when a create, update, or delete operation is performed, THEN THE Department_API SHALL complete the department operation successfully and suppress the notification failure

### Requirement 4: REST API for Instructor Management

**User Story:** As a university administrator, I want to manage instructors through a REST API, so that the React frontend can perform all instructor operations including course assignments and office assignments.

#### Acceptance Criteria

1. WHEN a GET request is sent to the Instructor_API index endpoint, THE Instructor_API SHALL return a JSON array of instructors ordered by last name, where each instructor includes their office assignment location and course assignments with department information
2. WHEN a GET request is sent to the Instructor_API with a valid instructor ID and an optional course ID parameter, THE Instructor_API SHALL return the instructor details and associated courses, and if a course ID is provided, also return the enrollments for that course
3. WHEN a POST request is sent to the Instructor_API with instructor data containing a LastName (max 50 characters), FirstMidName (max 50 characters), HireDate, an optional office assignment location (max 50 characters), and zero or more selected course IDs, THE Instructor_API SHALL validate the data, create the instructor record with course assignments, send a notification, and return the created instructor as JSON with a 201 status code
4. WHEN a PUT request is sent to the Instructor_API with valid instructor data and selected course IDs for an existing instructor, THE Instructor_API SHALL update the instructor record, replace the course assignments to match the provided course IDs (adding new and removing unselected), update the office assignment, send a notification, and return the updated instructor as JSON
5. WHEN a PUT request sets the office assignment location to null or empty, THE Instructor_API SHALL remove the office assignment from the instructor record
6. WHEN a DELETE request with a valid instructor ID is sent to the Instructor_API, THE Instructor_API SHALL remove the instructor record, set the instructor reference to null on any associated department, send a notification, and return a 204 status code
7. IF a request references a non-existent instructor ID, THEN THE Instructor_API SHALL return a 404 status code
8. IF a POST or PUT request is sent with missing required fields or field values exceeding maximum lengths, THEN THE Instructor_API SHALL return a 400 status code with an error response indicating which fields failed validation
9. IF the notification service is unavailable when a create, update, or delete operation succeeds, THEN THE Instructor_API SHALL complete the operation successfully and return the normal response without failing

### Requirement 5: REST API for Statistics and Home Data

**User Story:** As a university staff member, I want to access enrollment statistics through a REST API, so that the React frontend can display the About page with enrollment date group data.

#### Acceptance Criteria

1. WHEN a GET request is sent to the Statistics_API enrollment-stats endpoint, THE Statistics_API SHALL return a 200 status code with a JSON array of enrollment date group objects, each containing the enrollment date (date only, without time) and the student count for that date, sorted by enrollment date in ascending order
2. IF no student records exist in the database, THEN THE Statistics_API SHALL return a 200 status code with an empty JSON array
3. IF the Statistics_API fails to retrieve data from the database, THEN THE Statistics_API SHALL return a 500 status code with a JSON body containing a generic error message without exposing internal details

### Requirement 6: REST API for Notification Management

**User Story:** As a university administrator, I want to view and manage notifications through a REST API, so that the React frontend can display notification alerts and allow marking notifications as read.

#### Acceptance Criteria

1. WHEN a GET request is sent to the Notification_API endpoint, THE Notification_API SHALL return a JSON object containing the list of pending notifications (up to 10 most recent) and the total count of unread notifications
2. WHEN a POST request with a valid notification ID is sent to the Notification_API mark-read endpoint, THE Notification_API SHALL mark the specified notification as read and return a 200 status code with a JSON body containing a success flag set to true
3. IF the Notification microservice is unavailable, THEN THE Notification_API SHALL return a 503 status code with a JSON error body containing a message field, without causing the main application to fail

### Requirement 7: React Frontend Application Setup

**User Story:** As a developer, I want the React frontend to be integrated into the ASP.NET Core project, so that the SPA is served alongside the API from a single deployment.

#### Acceptance Criteria

1. WHEN a request arrives whose path does not begin with the API route prefix "/api/", THE SPA_Shell SHALL respond with an HTTP 200 containing the React application's root HTML document with content-type "text/html", enabling client-side routing to handle navigation
2. THE React_Frontend SHALL use client-side routing via the Router to navigate between pages (Students, Courses, Departments, Instructors, Home, About, Notifications) without issuing a full-page document request to the server on route change
3. THE React_Frontend SHALL include a navigation bar rendered on every page with links to all main sections: Home, About, Students, Courses, Instructors, and Departments
4. WHEN a user navigates directly to a deep-linked URL or refreshes the browser at any client-side route, THE SPA_Shell SHALL serve the React application's root HTML document and the Router SHALL render the page component that matches the current URL path
5. IF a user navigates to a client-side route that does not match any defined page (Students, Courses, Departments, Instructors, Home, About, Notifications), THEN THE React_Frontend SHALL render a not-found page indicating the requested route is invalid

### Requirement 8: Student Management UI

**User Story:** As a university administrator, I want to manage students through a responsive React interface, so that I can create, view, edit, delete, search, sort, and paginate student records.

#### Acceptance Criteria

1. WHEN the Students page is loaded, THE React_Frontend SHALL display a paginated table of students with columns for Last Name, First Name, and Enrollment Date, showing 10 records per page, sorted by Last Name in ascending order by default
2. WHEN a user enters text in the search field, THE React_Frontend SHALL filter the student list by last name or first name and reset to the first page
3. WHEN a user clicks a column header (Last Name or Enrollment Date), THE React_Frontend SHALL sort the student list by that column, toggling between ascending and descending order
4. WHEN a user clicks the Create New link, THE React_Frontend SHALL display a form for entering student data with fields for Last Name (maximum 50 characters), First Name (maximum 50 characters), and Enrollment Date
5. WHEN a user submits a valid student creation form, THE React_Frontend SHALL send a POST request to the Student_API and navigate to the student list on success
6. IF the Student_API returns validation errors on form submission (create or edit), THEN THE React_Frontend SHALL display field-specific error messages next to the corresponding form fields, and display non-field-specific errors at the top of the form
7. WHEN a user clicks Edit for a student, THE React_Frontend SHALL load the student data into an edit form, and WHEN the user submits valid changes, THE React_Frontend SHALL send a PUT request to the Student_API and navigate to the student list on success
8. WHEN a user clicks Delete for a student, THE React_Frontend SHALL display a confirmation view with student details and a confirm delete button, and WHEN the user confirms deletion, THE React_Frontend SHALL send a DELETE request to the Student_API and navigate to the student list on success
9. WHEN a user clicks Details for a student, THE React_Frontend SHALL display the full student record including all enrolled courses and grades
10. IF the Student_API returns a server error or is unreachable during any operation, THEN THE React_Frontend SHALL display an error message indicating the operation failed and preserve any user-entered form data

### Requirement 9: Course Management UI

**User Story:** As a university administrator, I want to manage courses through a responsive React interface, so that I can create, view, edit, and delete courses including teaching material images.

#### Acceptance Criteria

1. WHEN the Courses page is loaded, THE React_Frontend SHALL display a table of courses with columns for Number, Title, Credits, and Department
2. WHEN a user clicks the Create New link, THE React_Frontend SHALL display a form with fields for Course Number, Title, Credits, Department (as a dropdown of existing departments), and a file input for a teaching material image
3. WHEN a user submits a course creation or edit form with an image file, THE React_Frontend SHALL upload the file as multipart form data to the Course_API
4. IF the Course_API returns a validation error on form submission, THEN THE React_Frontend SHALL display the error messages adjacent to the corresponding form fields without clearing the user-entered data
5. WHEN a user submits a valid course creation or edit form, THE React_Frontend SHALL send the request to the Course_API and navigate to the course list on success
6. WHEN a user clicks Edit for a course, THE React_Frontend SHALL load the existing course data into an edit form pre-populated with the current Number, Title, Credits, Department, and current teaching material image filename if one exists
7. WHEN a user clicks Details for a course, THE React_Frontend SHALL display the course details including the teaching material image rendered visually if one exists
8. WHEN a user clicks Delete for a course, THE React_Frontend SHALL display a confirmation view with course details and a confirm delete button

### Requirement 10: Department Management UI

**User Story:** As a university administrator, I want to manage departments through a responsive React interface with concurrency conflict resolution, so that I can safely edit department records.

#### Acceptance Criteria

1. WHEN the Departments page is loaded, THE React_Frontend SHALL display a table of departments with columns for Name, Budget, Start Date, and Administrator full name, sorted by Name in ascending alphabetical order
2. WHEN a user submits a department edit form and a concurrency conflict (409 response) is detected, THE React_Frontend SHALL display each conflicting field's current database value alongside the user-submitted value for Name, Budget, Start Date, and Administrator, and present a Retry button that resubmits with the updated RowVersion and a Cancel button that discards changes and returns to the department list
3. WHEN a user creates or edits a department, THE React_Frontend SHALL provide a dropdown of instructors displaying each instructor's full name for selecting the department administrator
4. WHEN a user clicks Delete for a department, THE React_Frontend SHALL display a confirmation view showing the department Name, Budget, Start Date, and Administrator full name, along with a Confirm Delete button that submits the deletion and a Cancel button that returns to the department list
5. WHEN a department is successfully created, edited, or deleted, THE React_Frontend SHALL navigate the user back to the department list and display the updated data within 1 second of receiving the success response
6. IF the Departments page load request fails, THEN THE React_Frontend SHALL display an error message indicating the data could not be loaded and provide a Retry button that re-attempts the request

### Requirement 11: Instructor Management UI

**User Story:** As a university administrator, I want to manage instructors through a responsive React interface, so that I can create, view, edit, and delete instructors with their course and office assignments.

#### Acceptance Criteria

1. WHEN the Instructors page is loaded, THE React_Frontend SHALL display a table of instructors with columns for Last Name, First Name, Hire Date, Office Location, and Courses, sorted by Last Name in ascending order
2. IF no instructors exist in the system, THEN THE React_Frontend SHALL display an empty state message indicating no instructors are available
3. WHEN a user clicks on an instructor row, THE React_Frontend SHALL display the courses taught by that instructor in a dedicated section below the instructor table, showing each course title and its department
4. WHEN a user clicks on a course in the instructor courses section, THE React_Frontend SHALL display the enrollments for that course including student full name and grade, displaying "No grade" for enrollments where no grade has been assigned
5. WHEN a user creates or edits an instructor, THE React_Frontend SHALL display a checkbox list of all courses in the system for selecting course assignments, with currently assigned courses pre-checked during editing
6. WHEN a user creates or edits an instructor, THE React_Frontend SHALL provide an optional text field for the office assignment location with a maximum length of 50 characters
7. WHEN a user submits the create or edit form, THE React_Frontend SHALL validate that Last Name (maximum 50 characters), First Name (maximum 50 characters), and Hire Date (valid date) are provided before submission
8. IF form validation fails on create or edit, THEN THE React_Frontend SHALL display an error indication next to each invalid field and prevent form submission
9. WHEN a user clicks Delete for an instructor, THE React_Frontend SHALL display a confirmation view showing the instructor's full name, hire date, and office location, along with a confirm delete button

### Requirement 12: Notification UI

**User Story:** As a university administrator, I want to see notifications in the React interface, so that I receive real-time feedback about entity operations across the system.

#### Acceptance Criteria

1. THE React_Frontend SHALL display a notification indicator in the navigation bar showing the count of unread notifications, displaying "99+" when the count exceeds 99
2. WHEN a user clicks the notification indicator, THE React_Frontend SHALL display a dropdown list of up to 10 most recent notifications ordered by timestamp descending, each showing entity type, operation, and timestamp
3. WHEN a user clicks a notification in the dropdown, THE React_Frontend SHALL mark the notification as read via the Notification_API and update the unread count
4. THE React_Frontend SHALL poll the Notification_API every 5 seconds to refresh the notification count
5. IF the Notification_API is unreachable or returns a non-success response during polling, THEN THE React_Frontend SHALL retain the last known notification count and retry on the next polling interval

### Requirement 13: Standardized API Response Format

**User Story:** As a developer, I want all API endpoints to use a consistent response format, so that the React frontend can handle responses uniformly.

#### Acceptance Criteria

1. THE API_Controller SHALL return successful single-entity responses with the entity data as the JSON body and HTTP status code 200 for GET and PUT requests, 201 for POST requests, and 204 with no response body for DELETE requests
2. WHEN a GET request returns a collection, THE API_Controller SHALL return a JSON array of entity objects with HTTP status code 200
3. IF a validation error occurs, THEN THE API_Controller SHALL return a 400 status code with a JSON body containing a dictionary of field names mapped to arrays of error message strings, where non-field-level errors use an empty string as the key
4. IF the requested resource does not exist, THEN THE API_Controller SHALL return a 404 status code with a JSON body containing an error message indicating which resource was not found
5. IF a server error occurs, THEN THE API_Controller SHALL return a 500 status code with a JSON body containing a human-readable error message that excludes stack traces, database details, and internal service identifiers
6. THE API_Controller SHALL set the Content-Type header to application/json for all responses that include a JSON body

### Requirement 14: SPA Fallback and Static File Serving

**User Story:** As a developer, I want the ASP.NET Core backend to correctly serve the React SPA and its static assets, so that the application works in both development and production environments.

#### Acceptance Criteria

1. THE SPA_Shell SHALL serve static files from the wwwroot directory with correct MIME types so that the React build output (JavaScript, CSS, images) is accessible via their file paths
2. WHEN a request URL does not match any API route (prefixed with /api) or any existing static file, THE SPA_Shell SHALL return the React index.html with a 200 HTTP status code and content-type text/html to enable client-side routing
3. WHILE the application is running in development mode, THE SPA_Shell SHALL forward non-API, non-static-file requests to the React development server so that hot module replacement functions without a production build
4. THE SPA_Shell SHALL route all API endpoints under the /api URL prefix and process them before evaluating the SPA fallback, so that API requests are never intercepted by the fallback
5. IF the React development server is unreachable while the application is running in development mode, THEN THE SPA_Shell SHALL return a 502 status code with an error message indicating the development server is not available
