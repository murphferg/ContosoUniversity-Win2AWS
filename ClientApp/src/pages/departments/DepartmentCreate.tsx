import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { post, ApiError } from '../../apiClient';
import { useApi } from '../../hooks/useApi';
import { FormField } from '../../components/FormField';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { InstructorListItem } from '../../types';

export default function DepartmentCreate() {
  const navigate = useNavigate();
  const { data: instructors } = useApi<InstructorListItem[]>('/api/instructors');

  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});
      setGeneralError(null);
      setSubmitting(true);

      try {
        await post('/api/departments', {
          name,
          budget: budget ? parseFloat(budget) : 0,
          startDate,
          instructorId: instructorId ? parseInt(instructorId, 10) : null,
        });
        navigate('/departments');
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          if (err.errors) {
            setErrors(err.errors);
          } else {
            setGeneralError(err.message);
          }
        } else {
          setGeneralError('An unexpected error occurred.');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [name, budget, startDate, instructorId, navigate],
  );

  return (
    <div>
      <h1>Create Department</h1>

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
            {submitting ? 'Creating...' : 'Create'}
          </button>
          <button type="button" onClick={() => navigate('/departments')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
