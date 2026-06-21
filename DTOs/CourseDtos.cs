#nullable enable

using System.ComponentModel.DataAnnotations;

namespace ContosoUniversity.DTOs;

public record CourseListItemDto(int CourseId, string Title, int Credits, string DepartmentName);

public record CourseDetailDto(
    int CourseId,
    string Title,
    int Credits,
    int DepartmentId,
    string DepartmentName,
    string? TeachingMaterialImagePath);

public record CourseCreateDto
{
    [Required]
    public int CourseId { get; init; }

    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Title { get; init; } = default!;

    [Range(0, 5)]
    public int Credits { get; init; }

    [Required]
    public int DepartmentId { get; init; }
}

public record CourseUpdateDto
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Title { get; init; } = default!;

    [Range(0, 5)]
    public int Credits { get; init; }

    [Required]
    public int DepartmentId { get; init; }
}
