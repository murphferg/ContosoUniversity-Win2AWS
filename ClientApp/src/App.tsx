import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import NotFoundPage from './pages/NotFoundPage';
import StudentList from './pages/students/StudentList';
import StudentCreate from './pages/students/StudentCreate';
import StudentEdit from './pages/students/StudentEdit';
import StudentDetails from './pages/students/StudentDetails';
import StudentDelete from './pages/students/StudentDelete';
import CourseList from './pages/courses/CourseList';
import CourseCreate from './pages/courses/CourseCreate';
import CourseEdit from './pages/courses/CourseEdit';
import CourseDetails from './pages/courses/CourseDetails';
import CourseDelete from './pages/courses/CourseDelete';
import DepartmentList from './pages/departments/DepartmentList';
import DepartmentCreate from './pages/departments/DepartmentCreate';
import DepartmentEdit from './pages/departments/DepartmentEdit';
import DepartmentDelete from './pages/departments/DepartmentDelete';
import InstructorList from './pages/instructors/InstructorList';
import InstructorCreate from './pages/instructors/InstructorCreate';
import InstructorEdit from './pages/instructors/InstructorEdit';
import InstructorDelete from './pages/instructors/InstructorDelete';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="students">
            <Route index element={<StudentList />} />
            <Route path="create" element={<StudentCreate />} />
            <Route path=":id" element={<StudentDetails />} />
            <Route path=":id/edit" element={<StudentEdit />} />
            <Route path=":id/delete" element={<StudentDelete />} />
          </Route>
          <Route path="courses">
            <Route index element={<CourseList />} />
            <Route path="create" element={<CourseCreate />} />
            <Route path=":id" element={<CourseDetails />} />
            <Route path=":id/edit" element={<CourseEdit />} />
            <Route path=":id/delete" element={<CourseDelete />} />
          </Route>
          <Route path="instructors">
            <Route index element={<InstructorList />} />
            <Route path="create" element={<InstructorCreate />} />
            <Route path=":id" element={<div>Instructor Details</div>} />
            <Route path=":id/edit" element={<InstructorEdit />} />
            <Route path=":id/delete" element={<InstructorDelete />} />
          </Route>
          <Route path="departments">
            <Route index element={<DepartmentList />} />
            <Route path="create" element={<DepartmentCreate />} />
            <Route path=":id/edit" element={<DepartmentEdit />} />
            <Route path=":id/delete" element={<DepartmentDelete />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
