#nullable enable

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using ContosoUniversity.Data;
using ContosoUniversity.DTOs;
using ContosoUniversity.Models;
using ContosoUniversity.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ContosoUniversity.Controllers.Api;

[ApiController]
[Route("api/instructors")]
public class InstructorsApiController : ControllerBase
{
    private readonly SchoolContext _context;
    private readonly NotificationClient _notificationClient;

    public InstructorsApiController(SchoolContext context, NotificationClient notificationClient)
    {
        _context = context;
        _notificationClient = notificationClient;
    }

    // GET: api/instructors
    [HttpGet]
    public async Task<ActionResult<List<InstructorListItemDto>>> GetInstructors()
    {
        var instructors = await _context.Instructors
            .Include(i => i.OfficeAssignment)
            .Include(i => i.CourseAssignments)
                .ThenInclude(ca => ca.Course)
                    .ThenInclude(c => c.Department)
            .OrderBy(i => i.LastName)
            .ToListAsync();

        var result = instructors.Select(i => new InstructorListItemDto(
            i.ID,
            i.LastName,
            i.FirstMidName,
            i.HireDate,
            i.OfficeAssignment?.Location,
            i.CourseAssignments.Select(ca => new CourseAssignmentDto(
                ca.CourseID,
                ca.Course.Title,
                ca.Course.Department?.Name ?? ""
            )).ToList()
        )).ToList();

        return Ok(result);
    }

    // GET: api/instructors/{id}?courseId=X
    [HttpGet("{id}")]
    public async Task<ActionResult<InstructorDetailDto>> GetInstructor(int id, [FromQuery] int? courseId)
    {
        var instructor = await _context.Instructors
            .Include(i => i.OfficeAssignment)
            .Include(i => i.CourseAssignments)
                .ThenInclude(ca => ca.Course)
                    .ThenInclude(c => c.Department)
            .FirstOrDefaultAsync(i => i.ID == id);

        if (instructor == null)
        {
            return NotFound(new { error = $"Instructor with ID {id} not found" });
        }

        List<CourseEnrollmentDto>? enrollments = null;

        if (courseId.HasValue)
        {
            var course = instructor.CourseAssignments
                .Select(ca => ca.Course)
                .FirstOrDefault(c => c.CourseID == courseId.Value);

            if (course != null)
            {
                var courseEnrollments = await _context.Enrollments
                    .Include(e => e.Student)
                    .Where(e => e.CourseID == courseId.Value)
                    .ToListAsync();

                enrollments = courseEnrollments.Select(e => new CourseEnrollmentDto(
                    e.Student.FullName,
                    e.Grade?.ToString()
                )).ToList();
            }
        }

        var result = new InstructorDetailDto(
            instructor.ID,
            instructor.LastName,
            instructor.FirstMidName,
            instructor.HireDate,
            instructor.OfficeAssignment?.Location,
            instructor.CourseAssignments.Select(ca => new CourseAssignmentDto(
                ca.CourseID,
                ca.Course.Title,
                ca.Course.Department?.Name ?? ""
            )).ToList(),
            enrollments
        );

        return Ok(result);
    }

    // POST: api/instructors
    [HttpPost]
    public async Task<ActionResult<InstructorDetailDto>> CreateInstructor([FromBody] InstructorCreateDto dto)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblemResponse();
        }

        var instructor = new Instructor
        {
            LastName = dto.LastName,
            FirstMidName = dto.FirstMidName,
            HireDate = dto.HireDate,
            CourseAssignments = new List<CourseAssignment>()
        };

        // Add course assignments
        foreach (var courseId in dto.SelectedCourseIds)
        {
            instructor.CourseAssignments.Add(new CourseAssignment
            {
                CourseID = courseId,
                Instructor = instructor
            });
        }

        // Add office assignment if provided
        if (!string.IsNullOrWhiteSpace(dto.OfficeLocation))
        {
            instructor.OfficeAssignment = new OfficeAssignment
            {
                Location = dto.OfficeLocation
            };
        }

        _context.Instructors.Add(instructor);
        await _context.SaveChangesAsync();

        // Send notification (fire-and-forget)
        try
        {
            _notificationClient.SendNotification(
                "Instructor",
                instructor.ID.ToString(),
                instructor.FullName,
                EntityOperation.CREATE,
                "System");
        }
        catch
        {
            // Swallow notification failures
        }

        // Reload with includes for the response
        var created = await _context.Instructors
            .Include(i => i.OfficeAssignment)
            .Include(i => i.CourseAssignments)
                .ThenInclude(ca => ca.Course)
                    .ThenInclude(c => c.Department)
            .FirstAsync(i => i.ID == instructor.ID);

        var result = new InstructorDetailDto(
            created.ID,
            created.LastName,
            created.FirstMidName,
            created.HireDate,
            created.OfficeAssignment?.Location,
            created.CourseAssignments.Select(ca => new CourseAssignmentDto(
                ca.CourseID,
                ca.Course.Title,
                ca.Course.Department?.Name ?? ""
            )).ToList(),
            null
        );

        return CreatedAtAction(nameof(GetInstructor), new { id = created.ID }, result);
    }

    // PUT: api/instructors/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult<InstructorDetailDto>> UpdateInstructor(int id, [FromBody] InstructorUpdateDto dto)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblemResponse();
        }

        var instructor = await _context.Instructors
            .Include(i => i.OfficeAssignment)
            .Include(i => i.CourseAssignments)
                .ThenInclude(ca => ca.Course)
            .FirstOrDefaultAsync(i => i.ID == id);

        if (instructor == null)
        {
            return NotFound(new { error = $"Instructor with ID {id} not found" });
        }

        // Update basic properties
        instructor.LastName = dto.LastName;
        instructor.FirstMidName = dto.FirstMidName;
        instructor.HireDate = dto.HireDate;

        // Update office assignment
        if (string.IsNullOrWhiteSpace(dto.OfficeLocation))
        {
            // Remove office assignment if location is null/empty
            if (instructor.OfficeAssignment != null)
            {
                _context.OfficeAssignments.Remove(instructor.OfficeAssignment);
                instructor.OfficeAssignment = null;
            }
        }
        else
        {
            if (instructor.OfficeAssignment == null)
            {
                instructor.OfficeAssignment = new OfficeAssignment
                {
                    InstructorID = id,
                    Location = dto.OfficeLocation
                };
            }
            else
            {
                instructor.OfficeAssignment.Location = dto.OfficeLocation;
            }
        }

        // Replace course assignments
        var currentCourseIds = new HashSet<int>(instructor.CourseAssignments.Select(ca => ca.CourseID));
        var newCourseIds = new HashSet<int>(dto.SelectedCourseIds);

        // Remove courses no longer assigned
        foreach (var courseAssignment in instructor.CourseAssignments.ToList())
        {
            if (!newCourseIds.Contains(courseAssignment.CourseID))
            {
                _context.CourseAssignments.Remove(courseAssignment);
            }
        }

        // Add newly assigned courses
        foreach (var courseId in newCourseIds)
        {
            if (!currentCourseIds.Contains(courseId))
            {
                _context.CourseAssignments.Add(new CourseAssignment
                {
                    InstructorID = id,
                    CourseID = courseId
                });
            }
        }

        await _context.SaveChangesAsync();

        // Send notification (fire-and-forget)
        try
        {
            _notificationClient.SendNotification(
                "Instructor",
                instructor.ID.ToString(),
                instructor.FullName,
                EntityOperation.UPDATE,
                "System");
        }
        catch
        {
            // Swallow notification failures
        }

        // Reload with includes for the response
        var updated = await _context.Instructors
            .Include(i => i.OfficeAssignment)
            .Include(i => i.CourseAssignments)
                .ThenInclude(ca => ca.Course)
                    .ThenInclude(c => c.Department)
            .FirstAsync(i => i.ID == id);

        var result = new InstructorDetailDto(
            updated.ID,
            updated.LastName,
            updated.FirstMidName,
            updated.HireDate,
            updated.OfficeAssignment?.Location,
            updated.CourseAssignments.Select(ca => new CourseAssignmentDto(
                ca.CourseID,
                ca.Course.Title,
                ca.Course.Department?.Name ?? ""
            )).ToList(),
            null
        );

        return Ok(result);
    }

    // DELETE: api/instructors/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteInstructor(int id)
    {
        var instructor = await _context.Instructors
            .Include(i => i.OfficeAssignment)
            .FirstOrDefaultAsync(i => i.ID == id);

        if (instructor == null)
        {
            return NotFound(new { error = $"Instructor with ID {id} not found" });
        }

        // Null-out department references to this instructor
        var departments = await _context.Departments
            .Where(d => d.InstructorID == id)
            .ToListAsync();

        foreach (var department in departments)
        {
            department.InstructorID = null;
        }

        _context.Instructors.Remove(instructor);
        await _context.SaveChangesAsync();

        // Send notification (fire-and-forget)
        try
        {
            _notificationClient.SendNotification(
                "Instructor",
                id.ToString(),
                instructor.FullName,
                EntityOperation.DELETE,
                "System");
        }
        catch
        {
            // Swallow notification failures
        }

        return NoContent();
    }

    private ActionResult ValidationProblemResponse()
    {
        var errors = ModelState
            .Where(e => e.Value != null && e.Value.Errors.Count > 0)
            .ToDictionary(
                e => e.Key,
                e => e.Value!.Errors.Select(err => err.ErrorMessage).ToArray());

        return BadRequest(errors);
    }
}
