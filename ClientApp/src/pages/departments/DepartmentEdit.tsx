import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { FormField } from '../../components/FormField';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { DepartmentDetail, DepartmentConflict, InstructorListItem } from '../../types';

export default function DepartmentEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: department, loading, error: loadError, refetch } = useApi<DepartmentDetail>(
    id ? `/api/departments/${id}` : null,
  );
  const { data: instructors } = useApi<InstructorListItem[]>('/api/instructors');

  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [rowVersion, setRowVersion] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Concurrency conflict state
  const [conflict, setConflict] = useState<DepartmentConflict | null>(null);

  // Populate form when department loads
  useEffect(() => {
    if (department) {
      setName(department.name);
      setBudget(department.budget.toString());
      setStartDate(department.startDate.split('T')[0] ?? department.startDate);
      setInstructorId(department.instructorId?.toString() ?? '');
      setRowVersion(department.rowVersion);
    }
  }, [department]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});
      setGeneralError(null);
      setConflict(null);
      setSubmitting(true);

      try {
        const response = await fetch(`/api/departments/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            name,
            budget: budget ? parseFloat(budget) : 0,
            startDate,
            instructorId: instructorId ? parseInt(instructorId, 10) : null,
            rowVersion,
          }),
        });

        if (response.ok) {
          navigate('/departments');
          return;
        }

        const contentType = response.headers.get('Content-Type') ?? '';
        const isJson = contentType.includes('application/json');

        if (response.status === 409 && isJson) {
          const conflictData = await response.json() as DepartmentConflict;
          setConflict(conflictData);
        } else if (response.status === 400 && isJson) {
          const body = await response.json() as Record<string, string[]>;
          setErrors(body);
        } else if (isJson) {
          const body = await response.json() as { error?: string; message?: string };
          setGeneralError(body.error ?? body.message ?? `API error: ${response.status}`);
        } else {
          setGeneralError(`API error: ${response.status}`);
        }
      } catch {
        setGeneralError('An unexpected error occurred.');
      } finally {
        setSubmitting(false);
      }
    },
    [id, name, budget, startDate, instructorId, rowVersion, navigate],
  );

  const handleRetry = useCallback(async () => {
    // Refetch the latest data and reset form
    setConflict(null);
    setErrors({});
    setGeneralError(null);
    refetch();
  }, [refetch]);

  const handleCancel = useCallback(() => {
    navigate('/departments');
  }, [navigate]);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (loadError) {
    return (
      <div>
        <h1>Edit Department</h1>
        <ErrorMessage error={loadError} />
        <button type="button" onClick={refetch}>
          Retry
        </button>
      </div>
    );
  }

  if (!department) {
    return null;
  }

  // Display concurrency conflict resolution UI
  if (conflict) {
    return (
      <div>
        <h1>Edit Department - Concurrency Conflict</h1>
        <div
          role="alert"
          style={{
            padding: '1rem',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '0.25rem',
            marginBottom: '1rem',
          }}
        >
          <p style={{ marginTop: 0 }}>
            The record you attempted to edit was modified by another user after you loaded the page.
            The current database values are shown below alongside your submitted values.
          </p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Field
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Current (Database)
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Submitted (Your Values)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem', fontWeight: 'bold' }}>
                Name
              </td>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                {conflict.currentName}
              </td>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                {name}
              </td>
            </tr>
            <tr>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem', fontWeight: 'bold' }}>
                Budget
              </td>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                {conflict.currentBudget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </td>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                {parseFloat(budget).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </td>
            </tr>
            <tr>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem', fontWeight: 'bold' }}>
                Start Date
              </td>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                {new Date(conflict.currentStartDate).toLocaleDateString()}
              </td>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                {new Date(startDate).toLocaleDateString()}
              </td>
            </tr>
            <tr>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem', fontWeight: 'bold' }}>
                Administrator
              </td>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                {conflict.currentAdministratorName ?? '—'}
              </td>
              <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                {instructorId
                  ? instructors?.find((i) => i.id === parseInt(instructorId, 10))
                    ? `${instructors.find((i) => i.id === parseInt(instructorId, 10))!.lastName}, ${instructors.find((i) => i.id === parseInt(instructorId, 10))!.firstMidName}`
                    : instructorId
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={handleRetry}>
            Retry
          </button>
          <button type="button" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Edit Department</h1>

      {generalError && <ErrorMessage message={generalError} />}

      <form onSubmit={handleSubmit} style={{ maxWidth: '480px' }}>
        <FormField
          label="Name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          errors={errors['Name'] ?? errors['name']}
          required
          maxLength={50}
        />

        <FormField
          label="Budget"
          name="budget"
          type="number"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          errors={errors['Budget'] ?? errors['budget']}
          required
          min={0}
        />

        <FormField
          label="Start Date"
          name="startDate"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          errors={errors['StartDate'] ?? errors['startDate']}
          required
        />

        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="instructorId" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Administrator
          </label>
          <select
            id="instructorId"
            name="instructorId"
            value={instructorId}
            onChange={(e) => setInstructorId(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.375rem 0.75rem',
              border: '1px solid #ced4da',
              borderRadius: '0.25rem',
            }}
          >
            <option value="">-- Select Administrator --</option>
            {instructors?.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.lastName}, {inst.firstMidName}
              </option>
            ))}
          </select>
          {(errors['InstructorId'] ?? errors['instructorId']) && (
            <div role="alert" style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {(errors['InstructorId'] ?? errors['instructorId'])?.map((err, i) => (
                <p key={i} style={{ margin: 0 }}>{err}</p>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
