#nullable enable

using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ContosoUniversity.Data;
using ContosoUniversity.DTOs;
using ContosoUniversity.Models;
using ContosoUniversity.Services;

namespace ContosoUniversity.Controllers.Api
{
    [ApiController]
    [Route("api/students")]
    public class StudentsApiController : ControllerBase
    {
        private readonly SchoolContext _context;
        private readonly NotificationClient _notificationClient;

        public StudentsApiController(SchoolContext context, NotificationClient notificationClient)
        {
            _context = context;
            _notificationClient = notificationClient;
        }

        // GET: api/students?searchString=&sortField=LastName&sortDirection=asc&pageNumber=1&pageSize=10
        [HttpGet]
        public ActionResult<PaginatedResponse<StudentListItemDto>> GetStudents(
            string? searchString = null,
            string sortField = "LastName",
            string sortDirection = "asc",
            int pageNumber = 1,
            int pageSize = 10)
        {
            var students = _context.Students.AsQueryable();

            // Filter by search string
            if (!string.IsNullOrEmpty(searchString))
            {
                students = students.Where(s =>
                    s.LastName.Contains(searchString) ||
                    s.FirstMidName.Contains(searchString));
            }

            // Apply sorting
            students = ApplySorting(students, sortField, sortDirection);

            // Paginate
            var totalCount = students.Count();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);
            var items = students
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(s => new StudentListItemDto(s.ID, s.LastName, s.FirstMidName, s.EnrollmentDate))
                .ToList();

            var response = new PaginatedResponse<StudentListItemDto>(items, totalCount, pageNumber, totalPages);
            return Ok(response);
        }

        // GET: api/students/{id}
        [HttpGet("{id}")]
        public ActionResult<StudentDetailDto> GetStudent(int id)
        {
            var student = _context.Students
                .Include(s => s.Enrollments)
                    .ThenInclude(e => e.Course)
                .FirstOrDefault(s => s.ID == id);

            if (student == null)
            {
                return NotFound(new { error = $"Student with ID {id} not found" });
            }

            var enrollments = student.Enrollments.Select(e => new EnrollmentDto(
                e.EnrollmentID,
                e.Course?.Title ?? "",
                e.CourseID,
                e.Grade?.ToString()
            )).ToList();

            var dto = new StudentDetailDto(
                student.ID,
                student.LastName,
                student.FirstMidName,
                student.EnrollmentDate,
                enrollments);

            return Ok(dto);
        }

        // POST: api/students
        [HttpPost]
        public ActionResult<StudentDetailDto> CreateStudent([FromBody] StudentCreateDto dto)
        {
            if (!ModelState.IsValid)
            {
                return ValidationProblemResponse();
            }

            // Additional date range validation
            if (dto.EnrollmentDate < new DateTime(1753, 1, 1) || dto.EnrollmentDate > new DateTime(9999, 12, 31))
            {
                ModelState.AddModelError("EnrollmentDate", "Enrollment date must be between 1753 and 9999.");
                return ValidationProblemResponse();
            }

            var student = new Student
            {
                LastName = dto.LastName,
                FirstMidName = dto.FirstMidName,
                EnrollmentDate = dto.EnrollmentDate
            };

            _context.Students.Add(student);
            _context.SaveChanges();

            // Fire-and-forget notification
            var studentName = $"{student.FirstMidName} {student.LastName}";
            _ = Task.Run(() =>
            {
                try
                {
                    _notificationClient.SendNotification("Student", student.ID.ToString(), studentName, EntityOperation.CREATE, "System");
                }
                catch { /* swallow - fire and forget */ }
            });

            var result = new StudentDetailDto(
                student.ID,
                student.LastName,
                student.FirstMidName,
                student.EnrollmentDate,
                new System.Collections.Generic.List<EnrollmentDto>());

            return CreatedAtAction(nameof(GetStudent), new { id = student.ID }, result);
        }

        // PUT: api/students/{id}
        [HttpPut("{id}")]
        public ActionResult<StudentDetailDto> UpdateStudent(int id, [FromBody] StudentUpdateDto dto)
        {
            if (!ModelState.IsValid)
            {
                return ValidationProblemResponse();
            }

            if (id != dto.Id)
            {
                ModelState.AddModelError("Id", "The ID in the URL does not match the ID in the body.");
                return ValidationProblemResponse();
            }

            // Additional date range validation
            if (dto.EnrollmentDate < new DateTime(1753, 1, 1) || dto.EnrollmentDate > new DateTime(9999, 12, 31))
            {
                ModelState.AddModelError("EnrollmentDate", "Enrollment date must be between 1753 and 9999.");
                return ValidationProblemResponse();
            }

            var student = _context.Students.Find(id);
            if (student == null)
            {
                return NotFound(new { error = $"Student with ID {id} not found" });
            }

            student.LastName = dto.LastName;
            student.FirstMidName = dto.FirstMidName;
            student.EnrollmentDate = dto.EnrollmentDate;

            _context.SaveChanges();

            // Fire-and-forget notification
            var studentName = $"{student.FirstMidName} {student.LastName}";
            _ = Task.Run(() =>
            {
                try
                {
                    _notificationClient.SendNotification("Student", student.ID.ToString(), studentName, EntityOperation.UPDATE, "System");
                }
                catch { /* swallow - fire and forget */ }
            });

            // Reload enrollments for the response
            _context.Entry(student).Collection(s => s.Enrollments).Load();
            if (student.Enrollments != null)
            {
                foreach (var enrollment in student.Enrollments)
                {
                    _context.Entry(enrollment).Reference(e => e.Course).Load();
                }
            }

            var enrollments = (student.Enrollments ?? Enumerable.Empty<Enrollment>())
                .Select(e => new EnrollmentDto(
                    e.EnrollmentID,
                    e.Course?.Title ?? "",
                    e.CourseID,
                    e.Grade?.ToString()))
                .ToList();

            var result = new StudentDetailDto(
                student.ID,
                student.LastName,
                student.FirstMidName,
                student.EnrollmentDate,
                enrollments);

            return Ok(result);
        }

        // DELETE: api/students/{id}
        [HttpDelete("{id}")]
        public IActionResult DeleteStudent(int id)
        {
            var student = _context.Students.Find(id);
            if (student == null)
            {
                return NotFound(new { error = $"Student with ID {id} not found" });
            }

            var studentName = $"{student.FirstMidName} {student.LastName}";
            _context.Students.Remove(student);
            _context.SaveChanges();

            // Fire-and-forget notification
            _ = Task.Run(() =>
            {
                try
                {
                    _notificationClient.SendNotification("Student", id.ToString(), studentName, EntityOperation.DELETE, "System");
                }
                catch { /* swallow - fire and forget */ }
            });

            return NoContent();
        }

        private IQueryable<Student> ApplySorting(IQueryable<Student> students, string sortField, string sortDirection)
        {
            var isDescending = string.Equals(sortDirection, "desc", StringComparison.OrdinalIgnoreCase);

            return sortField?.ToLower() switch
            {
                "firstname" or "firstmidname" => isDescending
                    ? students.OrderByDescending(s => s.FirstMidName)
                    : students.OrderBy(s => s.FirstMidName),
                "enrollmentdate" => isDescending
                    ? students.OrderByDescending(s => s.EnrollmentDate)
                    : students.OrderBy(s => s.EnrollmentDate),
                _ => isDescending
                    ? students.OrderByDescending(s => s.LastName)
                    : students.OrderBy(s => s.LastName)
            };
        }

        private ActionResult ValidationProblemResponse()
        {
            var errors = ModelState
                .Where(x => x.Value != null && x.Value.Errors.Count > 0)
                .ToDictionary(
                    x => x.Key,
                    x => x.Value!.Errors.Select(e => e.ErrorMessage).ToArray());

            return BadRequest(errors);
        }
    }
}
