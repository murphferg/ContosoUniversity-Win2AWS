#nullable enable

using System;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ContosoUniversity.Data;
using ContosoUniversity.DTOs;
using ContosoUniversity.Models;
using ContosoUniversity.Services;

namespace ContosoUniversity.Controllers.Api;

[ApiController]
[Route("api/departments")]
public class DepartmentsApiController : ControllerBase
{
    private readonly SchoolContext _db;
    private readonly NotificationClient _notificationClient;

    public DepartmentsApiController(SchoolContext db, NotificationClient notificationClient)
    {
        _db = db;
        _notificationClient = notificationClient;
    }

    // GET: api/departments
    [HttpGet]
    public IActionResult GetAll()
    {
        var departments = _db.Departments
            .Include(d => d.Administrator)
            .Select(d => new DepartmentListItemDto(
                d.DepartmentID,
                d.Name,
                d.Budget,
                d.StartDate,
                d.Administrator != null
                    ? d.Administrator.LastName + ", " + d.Administrator.FirstMidName
                    : null))
            .ToList();

        return Ok(departments);
    }

    // GET: api/departments/{id}
    [HttpGet("{id}")]
    public IActionResult GetById(int id)
    {
        var department = _db.Departments.Find(id);
        if (department == null)
        {
            return NotFound(new { error = $"Department with ID {id} not found" });
        }

        var dto = new DepartmentDetailDto(
            department.DepartmentID,
            department.Name,
            department.Budget,
            department.StartDate,
            department.InstructorID,
            department.RowVersion);

        return Ok(dto);
    }

    // POST: api/departments
    [HttpPost]
    public IActionResult Create([FromBody] DepartmentCreateDto dto)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblemResponse();
        }

        var department = new Department
        {
            Name = dto.Name,
            Budget = dto.Budget,
            StartDate = dto.StartDate,
            InstructorID = dto.InstructorId
        };

        _db.Departments.Add(department);
        _db.SaveChanges();

        SendNotification("Department", department.DepartmentID.ToString(), department.Name, EntityOperation.CREATE);

        var result = new DepartmentDetailDto(
            department.DepartmentID,
            department.Name,
            department.Budget,
            department.StartDate,
            department.InstructorID,
            department.RowVersion);

        return CreatedAtAction(nameof(GetById), new { id = department.DepartmentID }, result);
    }

    // PUT: api/departments/{id}
    [HttpPut("{id}")]
    public IActionResult Update(int id, [FromBody] DepartmentUpdateDto dto)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblemResponse();
        }

        var department = _db.Departments.Find(id);
        if (department == null)
        {
            return NotFound(new { error = $"Department with ID {id} not found" });
        }

        // Set the original RowVersion for concurrency detection
        _db.Entry(department).Property(d => d.RowVersion).OriginalValue = dto.RowVersion;

        department.Name = dto.Name;
        department.Budget = dto.Budget;
        department.StartDate = dto.StartDate;
        department.InstructorID = dto.InstructorId;

        try
        {
            _db.SaveChanges();
        }
        catch (DbUpdateConcurrencyException)
        {
            var dbEntry = _db.Entry(department).GetDatabaseValues();
            if (dbEntry == null)
            {
                return NotFound(new { error = $"Department with ID {id} not found" });
            }

            var currentValues = (Department)dbEntry.ToObject();

            // Get administrator name for the current database value
            string? currentAdminName = null;
            if (currentValues.InstructorID.HasValue)
            {
                var instructor = _db.Instructors.Find(currentValues.InstructorID.Value);
                currentAdminName = instructor?.FullName;
            }

            var conflict = new DepartmentConflictDto(
                currentValues.Name,
                currentValues.Budget,
                currentValues.StartDate,
                currentAdminName,
                currentValues.RowVersion);

            return Conflict(conflict);
        }

        SendNotification("Department", department.DepartmentID.ToString(), department.Name, EntityOperation.UPDATE);

        var result = new DepartmentDetailDto(
            department.DepartmentID,
            department.Name,
            department.Budget,
            department.StartDate,
            department.InstructorID,
            department.RowVersion);

        return Ok(result);
    }

    // DELETE: api/departments/{id}
    [HttpDelete("{id}")]
    public IActionResult Delete(int id)
    {
        var department = _db.Departments.Find(id);
        if (department == null)
        {
            return NotFound(new { error = $"Department with ID {id} not found" });
        }

        var departmentName = department.Name;
        _db.Departments.Remove(department);
        _db.SaveChanges();

        SendNotification("Department", id.ToString(), departmentName, EntityOperation.DELETE);

        return NoContent();
    }

    private IActionResult ValidationProblemResponse()
    {
        var errors = ModelState
            .Where(e => e.Value != null && e.Value.Errors.Count > 0)
            .ToDictionary(
                e => e.Key,
                e => e.Value!.Errors.Select(err => err.ErrorMessage).ToArray());

        return BadRequest(errors);
    }

    private void SendNotification(string entityType, string entityId, string? entityDisplayName, EntityOperation operation)
    {
        try
        {
            _notificationClient.SendNotification(entityType, entityId, entityDisplayName!, operation, "System");
        }
        catch (Exception)
        {
            // Fire-and-forget: notification failures don't break the main operation
        }
    }
}
