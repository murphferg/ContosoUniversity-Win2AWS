import { useParams, Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { StudentDetail } from '../../types';

export default function StudentDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: student, loading, error } = useApi<StudentDetail>(
    id ? `/api/students/${id}` : null,
  );

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <ErrorMessage error={error} />;
  }

  if (!student) {
    return <p>Student not found.</p>;
  }

  return (
    <div>
      <h1>Student Details</h1>

      <dl style={{ maxWidth: '480px' }}>
        <dt><strong>Last Name</strong></dt>
        <dd>{student.lastName}</dd>

        <dt><strong>First Name</strong></dt>
        <dd>{student.firstMidName}</dd>

        <dt><strong>Enrollment Date</strong></dt>
        <dd>{new Date(student.enrollmentDate).toLocaleDateString()}</dd>
      </dl>

      <h2>Enrollments</h2>

      {student.enrollments.length === 0 ? (
        <p>No enrollments found.</p>
      ) : (
        <table style={{ width: '100%', maxWidth: '480px', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Course Title
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Grade
              </th>
            </tr>
          </thead>
          <tbody>
            {student.enrollments.map((enrollment) => (
              <tr key={enrollment.enrollmentId}>
                <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                  {enrollment.courseTitle}
                </td>
                <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                  {enrollment.grade ?? 'No grade'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <Link to={`/students/${student.id}/edit`}>Edit</Link>
        {' | '}
        <Link to="/students">Back to List</Link>
      </div>
    </div>
  );
}
