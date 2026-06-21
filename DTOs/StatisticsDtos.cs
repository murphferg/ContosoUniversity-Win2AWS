#nullable enable

using System;

namespace ContosoUniversity.DTOs;

public record EnrollmentStatDto(DateTime EnrollmentDate, int StudentCount);
