using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ContosoUniversity.Middleware;

/// <summary>
/// SPA fallback middleware that handles non-API, non-static-file GET requests.
/// In production: serves wwwroot/index.html.
/// In development: proxies to the React dev server (Vite on port 3000).
/// </summary>
public class SpaFallbackMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IHostEnvironment _env;
    private readonly ILogger<SpaFallbackMiddleware> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    private const string DevServerUrl = "http://localhost:3000";

    public SpaFallbackMiddleware(
        RequestDelegate next,
        IHostEnvironment env,
        ILogger<SpaFallbackMiddleware> logger,
        IHttpClientFactory httpClientFactory)
    {
        _next = next;
        _env = env;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Only handle GET requests
        if (!HttpMethods.IsGet(context.Request.Method))
        {
            await _next(context);
            return;
        }

        // Skip API routes — they should already be handled by endpoint routing
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            await _next(context);
            return;
        }

        // Skip requests for static files (files with extensions)
        var path = context.Request.Path.Value ?? string.Empty;
        if (HasFileExtension(path))
        {
            await _next(context);
            return;
        }

        if (_env.IsDevelopment())
        {
            await ProxyToDevServer(context);
        }
        else
        {
            await ServeIndexHtml(context);
        }
    }

    private async Task ProxyToDevServer(HttpContext context)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("SpaDevServer");
            var requestPath = context.Request.Path.Value ?? "/";
            var requestQuery = context.Request.QueryString.Value ?? string.Empty;
            var targetUrl = $"{DevServerUrl}{requestPath}{requestQuery}";

            var response = await client.GetAsync(targetUrl);

            context.Response.StatusCode = (int)response.StatusCode;

            // Copy relevant headers from the dev server response
            foreach (var header in response.Content.Headers)
            {
                context.Response.Headers[header.Key] = header.Value.ToArray();
            }

            var content = await response.Content.ReadAsByteArrayAsync();
            await context.Response.Body.WriteAsync(content);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "React dev server at {Url} is unreachable", DevServerUrl);

            context.Response.StatusCode = StatusCodes.Status502BadGateway;
            context.Response.ContentType = "text/plain";
            await context.Response.WriteAsync(
                "The React development server is not available. " +
                "Please ensure it is running on port 3000 (e.g., 'npm run dev' in ClientApp/).");
        }
        catch (TaskCanceledException ex) when (ex.InnerException is System.TimeoutException)
        {
            _logger.LogWarning(ex, "React dev server at {Url} timed out", DevServerUrl);

            context.Response.StatusCode = StatusCodes.Status502BadGateway;
            context.Response.ContentType = "text/plain";
            await context.Response.WriteAsync(
                "The React development server is not available. " +
                "Please ensure it is running on port 3000 (e.g., 'npm run dev' in ClientApp/).");
        }
    }

    private async Task ServeIndexHtml(HttpContext context)
    {
        var indexPath = Path.Combine(_env.ContentRootPath, "wwwroot", "index.html");

        if (!File.Exists(indexPath))
        {
            _logger.LogError("SPA index.html not found at {Path}", indexPath);
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            await context.Response.WriteAsync("index.html not found");
            return;
        }

        context.Response.StatusCode = StatusCodes.Status200OK;
        context.Response.ContentType = "text/html";
        await context.Response.SendFileAsync(indexPath);
    }

    private static bool HasFileExtension(string path)
    {
        // Check if the last segment of the path contains a dot (indicating a file extension)
        var lastSlash = path.LastIndexOf('/');
        var lastSegment = lastSlash >= 0 ? path[(lastSlash + 1)..] : path;
        return lastSegment.Contains('.');
    }
}
