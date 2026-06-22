using Amazon.CDK;

namespace ContosoUniversity.Infra;

internal sealed class Program
{
    public static void Main(string[] args)
    {
        var app = new App();

        // Account/region come from the deploying environment (CDK_DEFAULT_*),
        // which the AWS CLI/credentials populate. Override by setting them here
        // if you want to pin a specific account/region.
        new ContosoUniversityStack(app, "ContosoUniversityStack", new StackProps
        {
            Env = new Amazon.CDK.Environment
            {
                Account = System.Environment.GetEnvironmentVariable("CDK_DEFAULT_ACCOUNT"),
                Region = System.Environment.GetEnvironmentVariable("CDK_DEFAULT_REGION")
            },
            Description = "Contoso University — ECS Fargate (web + notifications), RDS PostgreSQL, SQS FIFO, S3/CloudFront SPA"
        });

        app.Synth();
    }
}
