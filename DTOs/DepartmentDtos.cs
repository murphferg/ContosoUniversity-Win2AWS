#nullable enable

using System;
using System.ComponentModel.DataAnnotations;

namespace ContosoUniversity.DTOs;

public record DepartmentListItemDto(
    int DepartmentId,
    string Name,
    decimal Budget,
    DateTime StartDate,
    string? AdministratorName);

public record DepartmentDetailDto(
    int DepartmentId,
    string Name,
    decimal Budget,
    DateTime StartDate,
    int? InstructorId,
    byte[] RowVersion);

public record DepartmentCreateDto
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Name { get; init; } = default!;

    [Required]
    public decimal Budget { get; init; }

    [Required]
    public DateTime StartDate { get; init; }

    public int? InstructorId { get; init; }
}

public record DepartmentUpdateDto
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Name { get; init; } = default!;

    [Required]
    public decimal Budget { get; init; }

    [Required]
    public DateTime StartDate { get; init; }

    public int? InstructorId { get; init; }

    [Required]
    public byte[] RowVersion { get; init; } = default!;
}

public record DepartmentConflictDto(
    string CurrentName,
    decimal CurrentBudget,
    DateTime CurrentStartDate,
    string? CurrentAdministratorName,
    byte[] CurrentRowVersion);
