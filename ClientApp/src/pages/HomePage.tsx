import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <section>
      <h1>Welcome to Contoso University</h1>
      <p>Contoso University is a sample application that demonstrates how to build a modern web application.</p>
      <nav aria-label="Quick links">
        <ul>
          <li><Link to="/students">Students</Link></li>
          <li><Link to="/courses">Courses</Link></li>
          <li><Link to="/instructors">Instructors</Link></li>
          <li><Link to="/departments">Departments</Link></li>
          <li><Link to="/about">About</Link></li>
        </ul>
      </nav>
    </section>
  );
}
