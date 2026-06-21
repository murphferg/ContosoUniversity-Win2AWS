#nullable enable

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using ContosoUniversity.Data;
using ContosoUniversity.DTOs;
using ContosoUniversity.Models;
using ContosoUniversity.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ContosoUniversity.Controllers.Api;

[ApiController]
[Route("api/courses")]
public class CoursesApiController : ControllerBase
{
    private readonly SchoolContext _db;
    private readonly NotificationClient _notificationClient;

    private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".bmp" };
    private const long MaxFileSize = 5 * 1024 * 1024; // 5MB

    public CoursesApiController(SchoolContext db, NotificationClient notificationClient)
    {
        _db = db;
        _notificationClient = notificationClient;
    }

    // GET: api/courses
    [HttpGet]
    public async Task<ActionResult<List<CourseListItemDto>>> GetCourses()
    {
        var courses = await _db.Courses
            .Include(c => c.Department)
            .Select(c => new CourseListItemDto(
                c.CourseID,
                c.Title,
                c.Credits,
                c.Department.Name))
            .ToListAsync();

        return Ok(courses);
    }

    // GET: api/courses/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<CourseDetailDto>> GetCourse(int id)
    {
        var course = await _db.Courses
            .Include(c => c.Department)
            .Where(c => c.CourseID == id)
            .Select(c => new CourseDetailDto(
                c.CourseID,
                c.Title,
                c.Credits,
                c.DepartmentID,
                c.Department.Name,
                c.TeachingMaterialImagePath))
            .FirstOrDefaultAsync();

        if (course == null)
        {
            return NotFound(new { error = $"Course with ID {id} not found" });
        }

        return Ok(course);
    }

    // POST: api/courses
    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<CourseDetailDto>> CreateCourse(
        [FromForm] CourseCreateDto dto,
        IFormFile? teachingMaterialImage)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblemDetails();
        }

        // Check if DepartmentId exists
        var departmentExists = await _db.Departments.AnyAsync(d => d.DepartmentID == dto.DepartmentId);
        if (!departmentExists)
        {
            ModelState.AddModelError("DepartmentId", "The specified department does not exist.");
            return ValidationProblemDetails();
        }

        // Check if CourseId already exists
        var courseExists = await _db.Courses.AnyAsync(c => c.CourseID == dto.CourseId);
        if (courseExists)
        {
            ModelState.AddModelError("CourseId", $"A course with ID {dto.CourseId} already exists.");
            return ValidationProblemDetails();
        }

        // Handle image upload
        string? imagePath = null;
        if (teachingMaterialImage != null && teachingMaterialImage.Length > 0)
        {
            var validationError = ValidateImageFile(teachingMaterialImage);
            if (validationError != null)
            {
                ModelState.AddModelError("teachingMaterialImage", validationError);
                return ValidationProblemDetails();
            }

            imagePath = await SaveImageFileAsync(teachingMaterialImage, dto.CourseId);
        }

        var course = new Course
        {
            CourseID = dto.CourseId,
            Title = dto.Title,
            Credits = dto.Credits,
            DepartmentID = dto.DepartmentId,
            TeachingMaterialImagePath = imagePath!
        };

        _db.Courses.Add(course);
        await _db.SaveChangesAsync();

        // Send notification (fire-and-forget)
        SendNotification("Course", course.CourseID.ToString(), course.Title, EntityOperation.CREATE);

        // Load department for response
        await _db.Entry(course).Reference(c => c.Department).LoadAsync();

        var result = new CourseDetailDto(
            course.CourseID,
            course.Title,
            course.Credits,
            course.DepartmentID,
            course.Department.Name,
            course.TeachingMaterialImagePath);

        return CreatedAtAction(nameof(GetCourse), new { id = course.CourseID }, result);
    }

    // PUT: api/courses/{id}
    [HttpPut("{id}")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<CourseDetailDto>> UpdateCourse(
        int id,
        [FromForm] CourseUpdateDto dto,
        IFormFile? teachingMaterialImage)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblemDetails();
        }

        var course = await _db.Courses.FindAsync(id);
        if (course == null)
        {
            return NotFound(new { error = $"Course with ID {id} not found" });
        }

        // Check if DepartmentId exists
        var departmentExists = await _db.Departments.AnyAsync(d => d.DepartmentID == dto.DepartmentId);
        if (!departmentExists)
        {
            ModelState.AddModelError("DepartmentId", "The specified department does not exist.");
            return ValidationProblemDetails();
        }

        // Handle image upload
        if (teachingMaterialImage != null && teachingMaterialImage.Length > 0)
        {
            var validationError = ValidateImageFile(teachingMaterialImage);
            if (validationError != null)
            {
                ModelState.AddModelError("teachingMaterialImage", validationError);
                return ValidationProblemDetails();
            }

            // Delete old image if exists
            DeleteImageFile(course.TeachingMaterialImagePath);

            // Save new image
            course.TeachingMaterialImagePath = await SaveImageFileAsync(teachingMaterialImage, id);
        }

        course.Title = dto.Title;
        course.Credits = dto.Credits;
        course.DepartmentID = dto.DepartmentId;

        await _db.SaveChangesAsync();

        // Send notification (fire-and-forget)
        SendNotification("Course", course.CourseID.ToString(), course.Title, EntityOperation.UPDATE);

        // Load department for response
        await _db.Entry(course).Reference(c => c.Department).LoadAsync();

        var result = new CourseDetailDto(
            course.CourseID,
            course.Title,
            course.Credits,
            course.DepartmentID,
            course.Department.Name,
            course.TeachingMaterialImagePath);

        return Ok(result);
    }

    // DELETE: api/courses/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteCourse(int id)
    {
        var course = await _db.Courses.FindAsync(id);
        if (course == null)
        {
            return NotFound(new { error = $"Course with ID {id} not found" });
        }

        var courseTitle = course.Title;

        // Delete associated image file if it exists
        DeleteImageFile(course.TeachingMaterialImagePath);

        _db.Courses.Remove(course);
        await _db.SaveChangesAsync();

        // Send notification (fire-and-forget)
        SendNotification("Course", id.ToString(), courseTitle, EntityOperation.DELETE);

        return NoContent();
    }

    #region Private Helpers

    private ActionResult ValidationProblemDetails()
    {
        var errors = ModelState
            .Where(e => e.Value!.Errors.Count > 0)
            .ToDictionary(
                e => e.Key,
                e => e.Value!.Errors.Select(err => err.ErrorMessage).ToArray());

        return BadRequest(errors);
    }

    private static string? ValidateImageFile(IFormFile file)
    {
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!AllowedExtensions.Contains(extension))
        {
            return "Invalid file type. Allowed types: jpg, jpeg, png, gif, bmp.";
        }

        if (file.Length > MaxFileSize)
        {
            return "File size exceeds the maximum allowed size of 5MB.";
        }

        return null;
    }

    private async Task<string> SaveImageFileAsync(IFormFile file, int courseId)
    {
        var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "images", "courses");
        if (!Directory.Exists(uploadsPath))
        {
            Directory.CreateDirectory(uploadsPath);
        }

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"course_{courseId}_{Guid.NewGuid()}{extension}";
        var filePath = Path.Combine(uploadsPath, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return $"/images/courses/{fileName}";
    }

    private void DeleteImageFile(string? imagePath)
    {
        if (string.IsNullOrEmpty(imagePath))
        {
            return;
        }

        try
        {
            // Convert relative path to absolute path
            var relativePath = imagePath.TrimStart('/');
            var absolutePath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", relativePath.Replace('/', Path.DirectorySeparatorChar));

            if (System.IO.File.Exists(absolutePath))
            {
                System.IO.File.Delete(absolutePath);
            }
        }
        catch (Exception ex)
        {
            // Log but don't fail the operation
            System.Diagnostics.Debug.WriteLine($"Error deleting image file: {ex.Message}");
        }
    }

    private void SendNotification(string entityType, string entityId, string? entityDisplayName, EntityOperation operation)
    {
        try
        {
            _notificationClient.SendNotification(entityType, entityId, entityDisplayName!, operation, "System");
        }
        catch (Exception ex)
        {
            // Fire-and-forget: log but don't break the main operation
            System.Diagnostics.Debug.WriteLine($"Failed to send notification: {ex.Message}");
        }
    }

    #endregion
}
