#nullable enable

using System.Collections.Generic;

namespace ContosoUniversity.DTOs;

public record PaginatedResponse<T>(
    List<T> Items,
    int TotalCount,
    int PageNumber,
    int TotalPages);

public record ValidationErrorResponse(Dictionary<string, string[]> Errors);
