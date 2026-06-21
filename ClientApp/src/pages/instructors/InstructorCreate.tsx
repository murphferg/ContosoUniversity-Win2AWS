import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ApiError, post } from '../../apiClient';
import { useApi } from '../../hooks/useApi';
import { FormField } from '../../components/FormField';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { CourseListItem } from '../../types';

export default function InstructorCreate() {
  const navigate = useNavigate();

  const { data: courses } = useApi<CourseListItem[]>('/api/courses');

  const [lastName, setLastName] = useState('');
  const [firstMidName, setFirstMidName] = useState('');
  const [hireDate, setHireDate] = useState('');
  const [officeLocation, setOfficeLocation] = useState('');
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};
    if (!lastName.trim()) {
      errors['LastName'] = ['Last Name is required.'];
    } else if (lastName.length > 50) {
      errors['LastName'] = ['Last Name must be 50 characters or fewer.'];
    }
    if (!firstMidName.trim()) {
      errors['FirstMidName'] = ['First Name is required.'];
    } else if (firstMidName.length > 50) {
      errors['FirstMidName'] = ['First Name must be 50 characters or fewer.'];
    }
    if (!hireDate) {
      errors['HireDate'] = ['Hire Date is required.'];
    }
    if (officeLocation.length > 50) {
      errors['OfficeLocation'] = ['Office Location must be 50 characters or fewer.'];
    }
    return errors;
  }

  function handleCourseToggle(courseId: number) {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId],
    );
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFieldErrors({});
      setGeneralError(null);

      const validationErrors = validate();
      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
        return;
      }

      setSubmitting(true);

      try {
        await post<unknown>('/api/instructors', {
          lastName,
          firstMidName,
          hireDate,
          officeLocation: officeLocation.trim() || null,
          selectedCourseIds,
        });
        navigate('/instructors');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastName, firstMidName, hireDate, officeLocation, selectedCourseIds, navigate],
  );

  return (
    <div>
      <h1>Create Instructor</h1>

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
          label="Hire Date"
          name="hireDate"
          type="date"
          value={hireDate}
          onChange={(e) => setHireDate(e.target.value)}
          errors={fieldErrors['HireDate'] ?? fieldErrors['hireDate']}
          required
        />

        <FormField
          label="Office Location"
          name="officeLocation"
          value={officeLocation}
          onChange={(e) => setOfficeLocation(e.target.value)}
          errors={fieldErrors['OfficeLocation'] ?? fieldErrors['officeLocation']}
          maxLength={50}
          placeholder="Optional"
        />

        <fieldset style={{ border: '1px solid #ced4da', borderRadius: '0.25rem', padding: '1rem', marginBottom: '1rem' }}>
          <legend>Course Assignments</legend>
          {courses && courses.length > 0 ? (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {courses.map((course) => (
                <label
                  key={course.courseId}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCourseIds.includes(course.courseId)}
                    onChange={() => handleCourseToggle(course.courseId)}
                  />
                  {course.courseId} - {course.title}
                </label>
              ))}
            </div>
          ) : (
            <p>No courses available.</p>
          )}
        </fieldset>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create'}
          </button>
          <Link to="/instructors">Back to List</Link>
        </div>
      </form>
    </div>
  );
}
