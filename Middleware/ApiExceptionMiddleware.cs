using System.Threading.Tasks;
using System;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace ContosoUniversity.Middleware;

/// <summary>
/// Catches unhandled exceptions for requests to /api paths and returns
/// a generic 500 JSON error response. Non-API exceptions propagate normally
/// so the SPA fallback or developer exception page can handle them.
/// </summary>
public class ApiExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ApiExceptionMiddleware> _logger;

    public ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                _logger.LogError(ex, "Unhandled exception on API path {Path}", context.Request.Path);

                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred." });
            }
            else
            {
                // Let non-API exceptions propagate for the SPA fallback or other handlers
                throw;
            }
        }
    }
}
