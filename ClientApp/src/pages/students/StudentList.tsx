import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { Pagination } from '../../components/Pagination';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { PaginatedResponse, StudentListItem } from '../../types';

type SortField = 'lastName' | 'firstMidName' | 'enrollmentDate';
type SortDirection = 'asc' | 'desc';

export default function StudentList() {
  const [searchString, setSearchString] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [pageNumber, setPageNumber] = useState(1);

  const { data, loading, error } = useApi<PaginatedResponse<StudentListItem>>(
    '/api/students',
    {
      searchString: appliedSearch || undefined,
      sortField,
      sortDirection,
      pageNumber,
      pageSize: 10,
    },
    [appliedSearch, sortField, sortDirection, pageNumber],
  );

  const handleSearch = useCallback(() => {
    setAppliedSearch(searchString);
    setPageNumber(1);
  }, [searchString]);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    },
    [handleSearch],
  );

  const handleSort = useCallback(
    (field: SortField) => {
      if (field === sortField) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField],
  );

  const handlePageChange = useCallback((page: number) => {
    setPageNumber(page);
  }, []);

  const renderSortIndicator = (field: SortField) => {
    if (field !== sortField) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <div>
      <h1>Students</h1>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by name..."
          value={searchString}
          onChange={(e) => setSearchString(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          aria-label="Search students by name"
          style={{ padding: '0.375rem 0.75rem', border: '1px solid #ced4da', borderRadius: '0.25rem' }}
        />
        <button type="button" onClick={handleSearch}>
          Search
        </button>
        <Link to="/students/create" style={{ marginLeft: 'auto' }}>
          Create New
        </Link>
      </div>

      <ErrorMessage error={error} />

      {loading && <p>Loading...</p>}

      {!loading && data && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleSort('lastName')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}
                  >
                    Last Name{renderSortIndicator('lastName')}
                  </button>
                </th>
                <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleSort('firstMidName')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}
                  >
                    First Name{renderSortIndicator('firstMidName')}
                  </button>
                </th>
                <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleSort('enrollmentDate')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', padding: 0 }}
                  >
                    Enrollment Date{renderSortIndicator('enrollmentDate')}
                  </button>
                </th>
                <th style={{ textAlign: 'left', borderBottom: '2px solid #dee2e6', padding: '0.5rem' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '1rem', textAlign: 'center' }}>
                    No students found.
                  </td>
                </tr>
              ) : (
                data.items.map((student) => (
                  <tr key={student.id}>
                    <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                      {student.lastName}
                    </td>
                    <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                      {student.firstMidName}
                    </td>
                    <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                      {new Date(student.enrollmentDate).toLocaleDateString()}
                    </td>
                    <td style={{ borderBottom: '1px solid #dee2e6', padding: '0.5rem' }}>
                      <Link to={`/students/${student.id}`}>Details</Link>
                      {' | '}
                      <Link to={`/students/${student.id}/edit`}>Edit</Link>
                      {' | '}
                      <Link to={`/students/${student.id}/delete`}>Delete</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div style={{ marginTop: '1rem' }}>
            <Pagination
              currentPage={data.pageNumber}
              totalPages={data.totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
