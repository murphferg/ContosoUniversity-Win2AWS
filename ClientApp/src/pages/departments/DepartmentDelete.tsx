import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { del, ApiError } from '../../apiClient';
import { useApi } from '../../hooks/useApi';
import { ConfirmDelete } from '../../components/ConfirmDelete';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { DepartmentListItem } from '../../types';

export default function DepartmentDelete() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: departments, loading, error: loadError, refetch } = useApi<DepartmentListItem[]>(
    '/api/departments',
  );

  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Find the specific department from the list
  const department = departments?.find((d) => d.departmentId === parseInt(id ?? '0', 10));

  const handleConfirm = useCallback(async () => {
    setGeneralError(null);
    setIsDeleting(true);

    try {
      await del(`/api/departments/${id}`);
      navigate('/departments');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setGeneralError(err.message);
      } else {
        setGeneralError('An unexpected error occurred.');
      }
    } finally {
      setIsDeleting(false);
    }
  }, [id, navigate]);

  const handleCancel = useCallback(() => {
    navigate('/departments');
  }, [navigate]);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (loadError) {
    return (
      <div>
        <h1>Delete Department</h1>
        <ErrorMessage error={loadError} />
        <button type="button" onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  if (!department) {
    return (
      <div>
        <h1>Delete Department</h1>
        <p>Department not found.</p>
        <button type="button" onClick={() => navigate('/departments')}>
          Back to List
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Delete Department</h1>

      {generalError && <ErrorMessage message={generalError} />}

      <ConfirmDelete
        title={`Delete "${department.name}"?`}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isDeleting={isDeleting}
      >
        <dl style={{ margin: 0 }}>
          <dt style={{ fontWeight: 'bold' }}>Name</dt>
          <dd style={{ marginLeft: 0, marginBottom: '0.5rem' }}>{department.name}</dd>

          <dt style={{ fontWeight: 'bold' }}>Budget</dt>
          <dd style={{ marginLeft: 0, marginBottom: '0.5rem' }}>
            {department.budget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </dd>

          <dt style={{ fontWeight: 'bold' }}>Start Date</dt>
          <dd style={{ marginLeft: 0, marginBottom: '0.5rem' }}>
            {new Date(department.startDate).toLocaleDateString()}
          </dd>

          <dt style={{ fontWeight: 'bold' }}>Administrator</dt>
          <dd style={{ marginLeft: 0, marginBottom: '0.5rem' }}>
            {department.administratorName ?? '—'}
          </dd>
        </dl>
      </ConfirmDelete>
    </div>
  );
}
