import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ApiError, del } from '../../apiClient';
import { useApi } from '../../hooks/useApi';
import { ConfirmDelete } from '../../components/ConfirmDelete';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { CourseDetail } from '../../types';

export default function CourseDelete() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: course, loading, error: loadError } = useApi<CourseDetail>(
    id ? `/api/courses/${id}` : null,
  );

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await del(`/api/courses/${id}`);
      navigate('/courses');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDeleteError(err.message);
      } else {
        setDeleteError('An unexpected error occurred.');
      }
    } finally {
      setDeleting(false);
    }
  }, [id, navigate]);

  const handleCancel = useCallback(() => {
    navigate('/courses');
  }, [navigate]);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (loadError) {
    return <ErrorMessage error={loadError} />;
  }

  if (!course) {
    return <p>Course not found.</p>;
  }

  return (
    <div>
      <h1>Delete Course</h1>

      {deleteError && <ErrorMessage message={deleteError} />}

      <ConfirmDelete
        title="Are you sure you want to delete this course?"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isDeleting={deleting}
      >
        <dl>
          <dt><strong>Number</strong></dt>
          <dd>{course.courseId}</dd>

          <dt><strong>Title</strong></dt>
          <dd>{course.title}</dd>

          <dt><strong>Credits</strong></dt>
          <dd>{course.credits}</dd>

          <dt><strong>Department</strong></dt>
          <dd>{course.departmentName}</dd>
        </dl>
      </ConfirmDelete>
    </div>
  );
}
