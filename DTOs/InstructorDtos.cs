#nullable enable

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ContosoUniversity.DTOs;

public record InstructorListItemDto(
    int Id,
    string LastName,
    string FirstMidName,
    DateTime HireDate,
    string? OfficeLocation,
    List<CourseAssignmentDto> Courses);

public record CourseAssignmentDto(int CourseId, string Title, string DepartmentName);

public record InstructorDetailDto(
    int Id,
    string LastName,
    string FirstMidName,
    DateTime HireDate,
    string? OfficeLocation,
    List<CourseAssignmentDto> Courses,
    List<CourseEnrollmentDto>? SelectedCourseEnrollments);

public record CourseEnrollmentDto(string StudentName, string? Grade);

public record InstructorCreateDto
{
    [Required]
    [StringLength(50)]
    public string LastName { get; init; } = default!;

    [Required]
    [StringLength(50)]
    public string FirstMidName { get; init; } = default!;

    [Required]
    public DateTime HireDate { get; init; }

    [StringLength(50)]
    public string? OfficeLocation { get; init; }

    public List<int> SelectedCourseIds { get; init; } = new();
}

public record InstructorUpdateDto
{
    [Required]
    [StringLength(50)]
    public string LastName { get; init; } = default!;

    [Required]
    [StringLength(50)]
    public string FirstMidName { get; init; } = default!;

    [Required]
    public DateTime HireDate { get; init; }

    [StringLength(50)]
    public string? OfficeLocation { get; init; }

    public List<int> SelectedCourseIds { get; init; } = new();
}
