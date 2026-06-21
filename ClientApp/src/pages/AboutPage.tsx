import { useApi } from '../hooks/useApi';
import { ErrorMessage } from '../components/ErrorMessage';
import type { EnrollmentStat } from '../types';

export default function AboutPage() {
  const { data, loading, error } = useApi<EnrollmentStat[]>('/api/statistics/enrollment-stats');

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <ErrorMessage error={error} />;
  }

  if (!data || data.length === 0) {
    return (
      <div>
        <h2>Enrollment Statistics</h2>
        <p>No enrollment data available</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Enrollment Statistics</h2>
      <table>
        <thead>
          <tr>
            <th>Enrollment Date</th>
            <th>Student Count</th>
          </tr>
        </thead>
        <tbody>
          {data.map((stat) => (
            <tr key={stat.enrollmentDate}>
              <td>{new Date(stat.enrollmentDate).toLocaleDateString()}</td>
              <td>{stat.studentCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
