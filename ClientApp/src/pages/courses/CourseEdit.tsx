import { useState, useCallback, useEffect, useId } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ApiError, putFormData } from '../../apiClient';
import { useApi } from '../../hooks/useApi';
import { FormField } from '../../components/FormField';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { CourseDetail, DepartmentListItem } from '../../types';

export default function CourseEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const selectId = useId();

  const { data: course, loading, error: loadError } = useApi<CourseDetail>(
    id ? `/api/courses/${id}` : null,
  );
  const { data: departments } = useApi<DepartmentListItem[]>('/api/departments');

  const [title, setTitle] = useState('');
  const [credits, setCredits] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (course && !initialized) {
      setTitle(course.title);
      setCredits(String(course.credits));
      setDepartmentId(String(course.departmentId));
      setInitialized(true);
    }
  }, [course, initialized]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFieldErrors({});
      setGeneralError(null);
      setSubmitting(true);

      try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('credits', credits);
        formData.append('departmentId', departmentId);
        if (imageFile) {
          formData.append('imageFile', imageFile);
        }

        await putFormData<unknown>(`/api/courses/${id}`, formData);
        navigate('/courses');
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
    [title, credits, departmentId, imageFile, id, navigate],
  );

  if (loading) {
    return <p>Loading...</p>;
  }

  if (loadError) {
    return <ErrorMessage error={loadError} />;
  }

  if (!course) {
    return <p>Course not found.</p>;
  }

  const deptErrorId = `departmentId-error-${selectId}`;
  const hasDeptErrors = fieldErrors['DepartmentId'] != null && fieldErrors['DepartmentId'].length > 0;
  const imageErrorId = `imageFile-error-${selectId}`;
  const hasImageErrors =
    (fieldErrors['ImageFile'] != null && fieldErrors['ImageFile'].length > 0) ||
    (fieldErrors['imageFile'] != null && fieldErrors['imageFile'].length > 0);
  const imageErrors = fieldErrors['ImageFile'] ?? fieldErrors['imageFile'] ?? [];

  return (
    <div>
      <h1>Edit Course</h1>

      {generalError && <ErrorMessage message={generalError} />}
      {fieldErrors[''] && fieldErrors[''].length > 0 && (
        <ErrorMessage message={fieldErrors[''].join(', ')} />
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: '480px' }}>
        <div style={{ marginBottom: '1rem' }}>
          <strong>Course Number:</strong> {course.courseId}
        </div>

        <FormField
          label="Title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          errors={fieldErrors['Title'] ?? fieldErrors['title']}
          required
          maxLength={50}
        />

        <FormField
          label="Credits"
          name="credits"
          type="number"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          errors={fieldErrors['Credits'] ?? fieldErrors['credits']}
          required
          min={0}
          max={5}
        />

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor={`department-${selectId}`} style={{ display: 'block', marginBottom: '0.25rem' }}>
            Department <span aria-hidden="true">*</span>
          </label>
          <select
            id={`department-${selectId}`}
            name="departmentId"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            required
            aria-invalid={hasDeptErrors ? true : undefined}
            aria-describedby={hasDeptErrors ? deptErrorId : undefined}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.375rem 0.75rem',
              border: hasDeptErrors ? '2px solid #dc3545' : '1px solid #ced4da',
              borderRadius: '0.25rem',
            }}
          >
            <option value="">-- Select Department --</option>
            {departments?.map((dept) => (
              <option key={dept.departmentId} value={dept.departmentId}>
                {dept.name}
              </option>
            ))}
          </select>
          {hasDeptErrors && (
            <div id={deptErrorId} role="alert" style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {fieldErrors['DepartmentId']!.map((error, index) => (
                <p key={index} style={{ margin: 0 }}>{error}</p>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor={`image-${selectId}`} style={{ display: 'block', marginBottom: '0.25rem' }}>
            Teaching Material Image
          </label>
          {course.teachingMaterialImagePath && (
            <p style={{ fontSize: '0.875rem', color: '#6c757d', margin: '0 0 0.25rem' }}>
              Current file: {course.teachingMaterialImagePath.split('/').pop()}
            </p>
          )}
          <input
            id={`image-${selectId}`}
            name="imageFile"
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.bmp"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            aria-invalid={hasImageErrors ? true : undefined}
            aria-describedby={hasImageErrors ? imageErrorId : undefined}
          />
          {hasImageErrors && (
            <div id={imageErrorId} role="alert" style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {imageErrors.map((error, index) => (
                <p key={index} style={{ margin: 0 }}>{error}</p>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save'}
          </button>
          <Link to="/courses">Back to List</Link>
        </div>
      </form>
    </div>
  );
}
