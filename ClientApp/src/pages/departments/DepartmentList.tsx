import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { DepartmentListItem } from '../../types';

export default function DepartmentList() {
  const { data, loading, error, refetch } = useApi<DepartmentListItem[]>('/api/departments');

  // Sort client-side by name ascending
  const sorted = data
    ? [...data].sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <div>
      <h1>Departments</h1>

      <div style={{ marginBottom: '1rem' }}>
        <Link to="/departments/create">Create New</Link>
      </div>

      {error && (
        <div>
          <ErrorMessage error={error} />
          <button type="button" onClick={refetch}>
            Retry
          </button>
        </div>
      )}

      {loading && <p>Loading...</p>}

      {!loading && !error && data && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Name
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Budget
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Start Date
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Administrator
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '1rem', textAlign: 'center' }}>
                  No departments found.
                </td>
              </tr>
            ) : (
              sorted.map((dept) => (
                <tr key={dept.departmentId}>
                  <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                    {dept.name}
                  </td>
                  <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                    {dept.budget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </td>
                  <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                    {new Date(dept.startDate).toLocaleDateString()}
                  </td>
                  <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                    {dept.administratorName ?? '—'}
                  </td>
                  <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                    <Link to={`/departments/${dept.departmentId}/edit`}>Edit</Link>
                    {' | '}
                    <Link to={`/departments/${dept.departmentId}/delete`}>Delete</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
