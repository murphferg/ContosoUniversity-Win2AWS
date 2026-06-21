import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { CourseListItem } from '../../types';

export default function CourseList() {
  const { data, loading, error } = useApi<CourseListItem[]>('/api/courses');

  return (
    <div>
      <h1>Courses</h1>

      <div style={{ marginBottom: '1rem' }}>
        <Link to="/courses/create">Create New</Link>
      </div>

      <ErrorMessage error={error} />

      {loading && <p>Loading...</p>}

      {!loading && data && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Number
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Title
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Credits
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Department
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '1rem', textAlign: 'center' }}>
                  No courses found.
                </td>
              </tr>
            ) : (
              data.map((course) => (
                <tr key={course.courseId}>
                  <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                    {course.courseId}
                  </td>
                  <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                    {course.title}
                  </td>
                  <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                    {course.credits}
                  </td>
                  <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                    {course.departmentName}
                  </td>
                  <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                    <Link to={`/courses/${course.courseId}`}>Details</Link>
                    {' | '}
                    <Link to={`/courses/${course.courseId}/edit`}>Edit</Link>
                    {' | '}
                    <Link to={`/courses/${course.courseId}/delete`}>Delete</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
