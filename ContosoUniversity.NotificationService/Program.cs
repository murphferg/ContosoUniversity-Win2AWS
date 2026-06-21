using Amazon.SQS;
using ContosoUniversity.NotificationService.Services;
using Newtonsoft.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.DateFormatString = "O";
    });

builder.Services.AddSingleton<IAmazonSQS, AmazonSQSClient>();
builder.Services.AddScoped<NotificationService>();

builder.Services.AddHealthChecks();

JsonConvert.DefaultSettings = () => new JsonSerializerSettings
{
    DateFormatString = "O"
};

var app = builder.Build();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
app.Run();
