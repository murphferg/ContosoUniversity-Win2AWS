import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { InstructorListItem, InstructorDetail, CourseAssignment } from '../../types';

export default function InstructorList() {
  const { data, loading, error } = useApi<InstructorListItem[]>('/api/instructors');
  const [selectedInstructorId, setSelectedInstructorId] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  // Fetch instructor detail with courseId to get enrollments
  const { data: instructorDetail, loading: enrollmentsLoading } = useApi<InstructorDetail>(
    selectedInstructorId !== null && selectedCourseId !== null
      ? `/api/instructors/${selectedInstructorId}`
      : null,
    selectedCourseId !== null ? { courseId: selectedCourseId } : undefined,
    [selectedInstructorId, selectedCourseId],
  );

  // Sort by LastName ascending
  const sorted = data
    ? [...data].sort((a, b) => a.lastName.localeCompare(b.lastName))
    : [];

  const selectedInstructor = data?.find((i) => i.id === selectedInstructorId) ?? null;

  function handleInstructorClick(id: number) {
    if (selectedInstructorId === id) {
      setSelectedInstructorId(null);
      setSelectedCourseId(null);
    } else {
      setSelectedInstructorId(id);
      setSelectedCourseId(null);
    }
  }

  function handleCourseClick(courseId: number) {
    setSelectedCourseId(courseId);
  }

  return (
    <div>
      <h1>Instructors</h1>

      <div style={{ marginBottom: '1rem' }}>
        <Link to="/instructors/create">Create New</Link>
      </div>

      {error && <ErrorMessage error={error} />}

      {loading && <p>Loading...</p>}

      {!loading && !error && data && (
        <>
          {sorted.length === 0 ? (
            <p>No instructors found.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                    Last Name
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                    First Name
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                    Hire Date
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                    Office
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                    Courses
                  </th>
                  <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((instructor) => (
                  <tr
                    key={instructor.id}
                    onClick={() => handleInstructorClick(instructor.id)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedInstructorId === instructor.id ? '#e8f4fd' : undefined,
                    }}
                  >
                    <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                      {instructor.lastName}
                    </td>
                    <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                      {instructor.firstMidName}
                    </td>
                    <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                      {new Date(instructor.hireDate).toLocaleDateString()}
                    </td>
                    <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                      {instructor.officeLocation ?? '—'}
                    </td>
                    <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                      {instructor.courses.map((c) => c.title).join(', ') || '—'}
                    </td>
                    <td
                      style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link to={`/instructors/${instructor.id}`}>Details</Link>
                      {' | '}
                      <Link to={`/instructors/${instructor.id}/edit`}>Edit</Link>
                      {' | '}
                      <Link to={`/instructors/${instructor.id}/delete`}>Delete</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {selectedInstructor && (
            <CoursesSection
              instructor={selectedInstructor}
              selectedCourseId={selectedCourseId}
              onCourseClick={handleCourseClick}
            />
          )}

          {selectedInstructorId !== null && selectedCourseId !== null && (
            <EnrollmentsSection
              enrollments={instructorDetail?.selectedCourseEnrollments ?? null}
              loading={enrollmentsLoading}
            />
          )}
        </>
      )}
    </div>
  );
}

interface CoursesSectionProps {
  instructor: InstructorListItem;
  selectedCourseId: number | null;
  onCourseClick: (courseId: number) => void;
}

function CoursesSection({ instructor, selectedCourseId, onCourseClick }: CoursesSectionProps) {
  return (
    <div style={{ marginTop: '2rem' }}>
      <h2>Courses taught by {instructor.firstMidName} {instructor.lastName}</h2>
      {instructor.courses.length === 0 ? (
        <p>No courses assigned.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Title
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Department
              </th>
            </tr>
          </thead>
          <tbody>
            {instructor.courses.map((course: CourseAssignment) => (
              <tr
                key={course.courseId}
                onClick={() => onCourseClick(course.courseId)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: selectedCourseId === course.courseId ? '#e8f4fd' : undefined,
                }}
              >
                <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                  {course.title}
                </td>
                <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                  {course.departmentName}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface EnrollmentsSectionProps {
  enrollments: { studentName: string; grade: string | null }[] | null;
  loading: boolean;
}

function EnrollmentsSection({ enrollments, loading }: EnrollmentsSectionProps) {
  if (loading) {
    return <p style={{ marginTop: '1rem' }}>Loading enrollments...</p>;
  }

  if (!enrollments) {
    return null;
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <h2>Students enrolled</h2>
      {enrollments.length === 0 ? (
        <p>No students enrolled.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Student Name
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Grade
              </th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((enrollment, index) => (
              <tr key={index}>
                <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                  {enrollment.studentName}
                </td>
                <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                  {enrollment.grade ?? 'No grade'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
