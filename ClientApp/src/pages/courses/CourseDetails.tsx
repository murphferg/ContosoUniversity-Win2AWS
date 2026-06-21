import { useParams, Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { ErrorMessage } from '../../components/ErrorMessage';
import type { CourseDetail } from '../../types';

export default function CourseDetails() {
  const { id } = useParams<{ id: string }>();
  const { data: course, loading, error } = useApi<CourseDetail>(
    id ? `/api/courses/${id}` : null,
  );

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <ErrorMessage error={error} />;
  }

  if (!course) {
    return <p>Course not found.</p>;
  }

  return (
    <div>
      <h1>Course Details</h1>

      <dl style={{ maxWidth: '480px' }}>
        <dt><strong>Number</strong></dt>
        <dd>{course.courseId}</dd>

        <dt><strong>Title</strong></dt>
        <dd>{course.title}</dd>

        <dt><strong>Credits</strong></dt>
        <dd>{course.credits}</dd>

        <dt><strong>Department</strong></dt>
        <dd>{course.departmentName}</dd>

        {course.teachingMaterialImagePath && (
          <>
            <dt><strong>Teaching Material</strong></dt>
            <dd>
              <img
                src={course.teachingMaterialImagePath}
                alt={`Teaching material for ${course.title}`}
                style={{ maxWidth: '100%', maxHeight: '300px', marginTop: '0.5rem' }}
              />
            </dd>
          </>
        )}
      </dl>

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
        <Link to={`/courses/${course.courseId}/edit`}>Edit</Link>
        {' | '}
        <Link to="/courses">Back to List</Link>
      </div>
    </div>
  );
}
