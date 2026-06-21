import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ApiError, del } from '../../apiClient';
import { useApi } from '../../hooks/useApi';
import { ConfirmDelete } from '../../components/ConfirmDelete';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { InstructorDetail } from '../../types';

export default function InstructorDelete() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: instructor, loading, error: loadError } = useApi<InstructorDetail>(
    id ? `/api/instructors/${id}` : null,
  );

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await del(`/api/instructors/${id}`);
      navigate('/instructors');
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
    navigate('/instructors');
  }, [navigate]);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (loadError) {
    return <ErrorMessage error={loadError} />;
  }

  if (!instructor) {
    return <p>Instructor not found.</p>;
  }

  return (
    <div>
      <h1>Delete Instructor</h1>

      {deleteError && <ErrorMessage message={deleteError} />}

      <ConfirmDelete
        title="Are you sure you want to delete this instructor?"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isDeleting={deleting}
      >
        <dl>
          <dt><strong>Name</strong></dt>
          <dd>{instructor.lastName}, {instructor.firstMidName}</dd>

          <dt><strong>Hire Date</strong></dt>
          <dd>{new Date(instructor.hireDate).toLocaleDateString()}</dd>

          <dt><strong>Office</strong></dt>
          <dd>{instructor.officeLocation ?? '—'}</dd>
        </dl>
      </ConfirmDelete>
    </div>
  );
}
