#nullable enable

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace ContosoUniversity.DTOs;

public record StudentListItemDto(int Id, string LastName, string FirstMidName, DateTime EnrollmentDate);

public record StudentDetailDto(
    int Id,
    string LastName,
    string FirstMidName,
    DateTime EnrollmentDate,
    List<EnrollmentDto> Enrollments);

public record EnrollmentDto(int EnrollmentId, string CourseTitle, int CourseId, string? Grade);

public record StudentCreateDto
{
    [Required]
    [StringLength(50)]
    public string LastName { get; init; } = default!;

    [Required]
    [StringLength(50)]
    public string FirstMidName { get; init; } = default!;

    [Required]
    public DateTime EnrollmentDate { get; init; }
}

public record StudentUpdateDto
{
    [Required]
    public int Id { get; init; }

    [Required]
    [StringLength(50)]
    public string LastName { get; init; } = default!;

    [Required]
    [StringLength(50)]
    public string FirstMidName { get; init; } = default!;

    [Required]
    public DateTime EnrollmentDate { get; init; }
}
