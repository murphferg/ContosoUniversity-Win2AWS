var builder = DistributedApplication.CreateBuilder(args);

// PostgreSQL — persistent local container with a data volume. The database is
// named "contoso" to match the existing schema; its connection string is wired
// into the web app under the existing "DefaultConnection" name (no app change).
// DbInitializer.EnsureCreated() seeds the fresh container on first run.
var postgres = builder.AddPostgres("postgres")
    .WithDataVolume()
    .WithLifetime(ContainerLifetime.Persistent);

var contosoDb = postgres.AddDatabase("contoso");

// LocalStack — local AWS emulator hosting the SQS FIFO queue the notification
// service uses. No AWS credentials needed for local development.
var localstack = builder.AddContainer("localstack", "localstack/localstack", "3")
    .WithHttpEndpoint(targetPort: 4566, name: "gateway")
    .WithEnvironment("SERVICES", "sqs")
    .WithEnvironment("DEBUG", "0")
    .WithLifetime(ContainerLifetime.Persistent);

var localstackGateway = localstack.GetEndpoint("gateway");

// Notification microservice — sends/receives notifications via SQS. Points the
// AWS SDK at LocalStack; the service creates the FIFO queue on startup.
var notifications = builder.AddProject<Projects.ContosoUniversity_NotificationService>("notifications")
    .WithEnvironment("AWS__ServiceURL", localstackGateway)
    .WithEnvironment("AWS__Region", "us-east-1")
    .WaitFor(localstack)
    .WithHttpHealthCheck("/health");

// Web app — ASP.NET Core MVC + API. Consumes Postgres (DefaultConnection) and
// the notification service via its existing config keys.
var webapp = builder.AddProject<Projects.ContosoUniversity>("webapp")
    .WithReference(contosoDb)
    .WithEnvironment("ConnectionStrings__DefaultConnection", contosoDb)
    .WithReference(notifications)
    .WithEnvironment("AppSettings__NotificationServiceBaseUrl", notifications.GetEndpoint("http"))
    .WaitFor(contosoDb)
    .WaitFor(notifications)
    .WithExternalHttpEndpoints();

// React SPA (Vite dev server). The web app proxies non-API requests to it on
// port 3000 in development; vite.config proxies /api back to the web app. Pin
// the Vite port to 3000 to match those existing hardcoded endpoints.
#pragma warning disable ASPIREBROWSERLOGS001 // WithBrowserLogs is evaluation-only in 13.4
builder.AddViteApp("clientapp", "../ClientApp")
    .WithEndpoint("http", endpoint => endpoint.TargetPort = 3000)
    .WithReference(webapp)
    .WaitFor(webapp)
    .WithEnvironment("BROWSER", "none")
    .WithBrowserLogs()
    .WithExternalHttpEndpoints();
#pragma warning restore ASPIREBROWSERLOGS001

builder.Build().Run();
