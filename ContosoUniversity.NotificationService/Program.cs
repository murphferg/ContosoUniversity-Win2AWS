using Amazon.Runtime;
using Amazon.SQS;
using Amazon.SQS.Model;
using ContosoUniversity.NotificationService.Services;
using Newtonsoft.Json;

var builder = WebApplication.CreateBuilder(args);

// Aspire service defaults: OpenTelemetry, health checks, service discovery,
// and standard HTTP resilience. Wired by the Aspire AppHost.
builder.AddServiceDefaults();

builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.DateFormatString = "O";
    });

// SQS client. When the AppHost supplies AWS:ServiceURL (LocalStack), point the
// client at the local emulator with placeholder credentials; otherwise fall
// back to the default AWS credential/endpoint resolution chain (real AWS).
builder.Services.AddSingleton<IAmazonSQS>(sp =>
{
    var configuration = sp.GetRequiredService<IConfiguration>();
    var serviceUrl = configuration["AWS:ServiceURL"];

    if (!string.IsNullOrWhiteSpace(serviceUrl))
    {
        var sqsConfig = new AmazonSQSConfig
        {
            ServiceURL = serviceUrl,
            AuthenticationRegion = configuration["AWS:Region"] ?? "us-east-1"
        };
        return new AmazonSQSClient(new BasicAWSCredentials("test", "test"), sqsConfig);
    }

    return new AmazonSQSClient();
});

builder.Services.AddScoped<NotificationService>();

builder.Services.AddHealthChecks();

JsonConvert.DefaultSettings = () => new JsonSerializerSettings
{
    DateFormatString = "O"
};

var app = builder.Build();

// Aspire default endpoints: /health and /alive (Development only).
app.MapDefaultEndpoints();

app.MapControllers();

// When running against LocalStack, the FIFO queue does not exist yet. Create it
// (idempotently) and use the resolved URL so SendMessage/ReceiveMessage target
// the local queue. Against real AWS this is skipped and the configured
// AppSettings:SqsQueueUrl is used as-is.
await EnsureLocalStackQueueAsync(app);

app.Run();

static async Task EnsureLocalStackQueueAsync(WebApplication app)
{
    var serviceUrl = app.Configuration["AWS:ServiceURL"];
    if (string.IsNullOrWhiteSpace(serviceUrl))
    {
        return; // Real AWS — the queue already exists.
    }

    var logger = app.Services.GetRequiredService<ILogger<Program>>();
    var sqs = app.Services.GetRequiredService<IAmazonSQS>();

    // Derive the FIFO queue name from the configured queue URL (last path segment),
    // defaulting to contoso.fifo.
    var configuredUrl = app.Configuration["AppSettings:SqsQueueUrl"];
    var queueName = !string.IsNullOrWhiteSpace(configuredUrl)
        ? configuredUrl.TrimEnd('/').Split('/')[^1]
        : "contoso.fifo";
    if (!queueName.EndsWith(".fifo", StringComparison.OrdinalIgnoreCase))
    {
        queueName += ".fifo";
    }

    for (var attempt = 1; attempt <= 15; attempt++)
    {
        try
        {
            var response = await sqs.CreateQueueAsync(new CreateQueueRequest
            {
                QueueName = queueName,
                Attributes = new Dictionary<string, string>
                {
                    ["FifoQueue"] = "true",
                    ["ContentBasedDeduplication"] = "false"
                }
            });

            app.Configuration["AppSettings:SqsQueueUrl"] = response.QueueUrl;
            logger.LogInformation("LocalStack SQS FIFO queue ready at {QueueUrl}", response.QueueUrl);
            return;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Waiting for LocalStack SQS (attempt {Attempt}/15)", attempt);
            await Task.Delay(TimeSpan.FromSeconds(2));
        }
    }

    logger.LogError("Could not provision the LocalStack SQS queue after multiple attempts.");
}
