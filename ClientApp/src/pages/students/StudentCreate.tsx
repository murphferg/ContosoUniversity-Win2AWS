import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ApiError, post } from '../../apiClient';
import { FormField } from '../../components/FormField';
import { ErrorMessage } from '../../components/ErrorMessage';

export default function StudentCreate() {
  const navigate = useNavigate();

  const [lastName, setLastName] = useState('');
  const [firstMidName, setFirstMidName] = useState('');
  const [enrollmentDate, setEnrollmentDate] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFieldErrors({});
      setGeneralError(null);
      setSubmitting(true);

      try {
        await post<unknown>('/api/students', {
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
    [lastName, firstMidName, enrollmentDate, navigate],
  );

  return (
    <div>
      <h1>Create Student</h1>

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
            {submitting ? 'Creating...' : 'Create'}
          </button>
          <Link to="/students">Back to List</Link>
        </div>
      </form>
    </div>
  );
}
