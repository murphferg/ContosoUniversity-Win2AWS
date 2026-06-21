import { Link, Outlet } from 'react-router-dom';
import NotificationBell from './NotificationBell';

export default function Layout() {
  return (
    <>
      <header>
        <nav aria-label="Main navigation">
          <Link to="/">Contoso University</Link>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/students">Students</Link></li>
            <li><Link to="/courses">Courses</Link></li>
            <li><Link to="/instructors">Instructors</Link></li>
            <li><Link to="/departments">Departments</Link></li>
          </ul>
          <NotificationBell />
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
