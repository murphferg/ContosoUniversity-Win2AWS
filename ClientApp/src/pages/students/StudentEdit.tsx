import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ApiError, put } from '../../apiClient';
import { useApi } from '../../hooks/useApi';
import { FormField } from '../../components/FormField';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { StudentDetail } from '../../types';

export default function StudentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: student, loading, error: loadError } = useApi<StudentDetail>(
    id ? `/api/students/${id}` : null,
  );

  const [lastName, setLastName] = useState('');
  const [firstMidName, setFirstMidName] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (student && !initialized) {
      setLastName(student.lastName);
      setFirstMidName(student.firstMidName);
      setEnrollmentDate(student.enrollmentDate.split('T')[0] ?? student.enrollmentDate);
      setInitialized(true);
    }
  }, [student, initialized]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFieldErrors({});
      setGeneralError(null);
      setSubmitting(true);

      try {
        await put<unknown>(`/api/students/${id}`, {
          id: Number(id),
          lastName,
          firstMidName,
          enrollmentDate,
        });
        navigate('/students');
      } catch (err: unknown) {
        if (err instanceof ApiError && err.errors) {
          setFieldErrors(err.errors);
        } else if (err instanceof ApiError) {
          setGeneralError(err.message);
        } else {
          setGeneralError('An unexpected error occurred.');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [id, lastName, firstMidName, enrollmentDate, navigate],
  );

  if (loading) {
    return <p>Loading...</p>;
  }

  if (loadError) {
    return <ErrorMessage error={loadError} />;
  }

  if (!student) {
    return <p>Student not found.</p>;
  }

  return (
    <div>
      <h1>Edit Student</h1>

      {generalError && <ErrorMessage message={generalError} />}
      {fieldErrors[''] && fieldErrors[''].length > 0 && (
        <ErrorMessage message={fieldErrors[''].join(', ')} />
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: '480px' }}>
        <FormField
          label="Last Name"
          name="lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          errors={fieldErrors['LastName'] ?? fieldErrors['lastName']}
          required
          maxLength={50}
        />

        <FormField
          label="First Name"
          name="firstMidName"
          value={firstMidName}
          onChange={(e) => setFirstMidName(e.target.value)}
          errors={fieldErrors['FirstMidName'] ?? fieldErrors['firstMidName']}
          required
          maxLength={50}
        />

        <FormField
          label="Enrollment Date"
          name="enrollmentDate"
          type="date"
          value={enrollmentDate}
          onChange={(e) => setEnrollmentDate(e.target.value)}
          errors={fieldErrors['EnrollmentDate'] ?? fieldErrors['enrollmentDate']}
          required
        />

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save'}
          </button>
          <Link to="/students">Back to List</Link>
        </div>
      </form>
    </div>
  );
}
