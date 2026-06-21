using System;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using ContosoUniversity.Data;
using ContosoUniversity.Middleware;
using ContosoUniversity.Services;

var builder = WebApplication.CreateBuilder(args);

// -------------------------------------------------------------------------
// Service registrations (migrated from Global.asax.cs Application_Start and
// the legacy Startup.ConfigureServices)
// -------------------------------------------------------------------------

// MVC with Razor Views (replaces AreaRegistration + FilterConfig + RouteConfig)
builder.Services.AddControllersWithViews();

// Entity Framework Core - SchoolContext
// Connection string migrated from Web.config <connectionStrings> to appsettings.json
builder.Services.AddDbContext<SchoolContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Typed HTTP client for Notification Microservice
builder.Services.AddHttpClient<NotificationClient>();

// HTTP client for SPA dev server proxy (used in development mode)
builder.Services.AddHttpClient("SpaDevServer", client =>
{
    client.Timeout = TimeSpan.FromSeconds(5);
});

// -------------------------------------------------------------------------
// Kestrel / IIS request limits
// Migrated from Web.config:
//   <httpRuntime maxRequestLength="10240" executionTimeout="3600" />
//   <requestLimits maxAllowedContentLength="10485760" />
// maxRequestLength is in KB (10240 KB = 10 MB); MaxRequestBodySize is in bytes.
// -------------------------------------------------------------------------
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 10_485_760; // 10 MB
});

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 10_485_760; // 10 MB
    options.Limits.KeepAliveTimeout = TimeSpan.FromSeconds(3600); // executionTimeout equivalent
});

// -------------------------------------------------------------------------
// Build the application
// -------------------------------------------------------------------------
var app = builder.Build();

// -------------------------------------------------------------------------
// Middleware pipeline (migrated from legacy Startup.Configure)
// Ordering follows ASP.NET Core best-practice conventions.
// -------------------------------------------------------------------------
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    // Replaces FilterConfig's HandleErrorAttribute for production error handling
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// Global API exception handler — intercepts unhandled exceptions on /api paths
// and returns a generic 500 JSON response. Must be registered before routing.
app.UseMiddleware<ApiExceptionMiddleware>();

// Serve static files from wwwroot (replaces BundleConfig script/style bundles;
// scripts/styles are referenced directly via <script> and <link> tags or tooling)
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

// Default MVC route - replaces RouteConfig.RegisterRoutes
// Pattern mirrors the original: {controller}/{action}/{id}
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// SPA fallback — must be registered AFTER endpoint routing so that API routes
// (/api/*) and static files are served first. For any unmatched non-API,
// non-static-file GET request, serves index.html (production) or proxies to
// the React dev server (development).
app.UseMiddleware<SpaFallbackMiddleware>();

// -------------------------------------------------------------------------
// Database initialisation (migrated from Global.asax.cs InitializeDatabase)
// Resolve SchoolContext from the DI container and seed the database before
// the application starts accepting requests.
// -------------------------------------------------------------------------
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var context = services.GetRequiredService<SchoolContext>();
    DbInitializer.Initialize(context);
}

app.Run();
