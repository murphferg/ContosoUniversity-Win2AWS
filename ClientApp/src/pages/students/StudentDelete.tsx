import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ApiError, del } from '../../apiClient';
import { useApi } from '../../hooks/useApi';
import { ConfirmDelete } from '../../components/ConfirmDelete';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { StudentDetail } from '../../types';

export default function StudentDelete() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: student, loading, error: loadError } = useApi<StudentDetail>(
    id ? `/api/students/${id}` : null,
  );

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    setDeleteError(null);
    setDeleting(true);
    try {
      await del(`/api/students/${id}`);
      navigate('/students');
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
    navigate('/students');
  }, [navigate]);

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
      <h1>Delete Student</h1>

      {deleteError && <ErrorMessage message={deleteError} />}

      <ConfirmDelete
        title="Are you sure you want to delete this student?"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isDeleting={deleting}
      >
        <dl>
          <dt><strong>Last Name</strong></dt>
          <dd>{student.lastName}</dd>

          <dt><strong>First Name</strong></dt>
          <dd>{student.firstMidName}</dd>

          <dt><strong>Enrollment Date</strong></dt>
          <dd>{new Date(student.enrollmentDate).toLocaleDateString()}</dd>
        </dl>
      </ConfirmDelete>
    </div>
  );
}
