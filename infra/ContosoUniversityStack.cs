using System.Collections.Generic;
using Amazon.CDK;
using Amazon.CDK.AWS.CloudFront;
using Amazon.CDK.AWS.CloudFront.Origins;
using Amazon.CDK.AWS.EC2;
using Amazon.CDK.AWS.ECS;
using Amazon.CDK.AWS.ECS.Patterns;
using Amazon.CDK.AWS.RDS;
using Amazon.CDK.AWS.S3;
using Amazon.CDK.AWS.S3.Deployment;
using Amazon.CDK.AWS.SQS;
using Constructs;

namespace ContosoUniversity.Infra;

/// <summary>
/// All AWS infrastructure for Contoso University:
///   - VPC (2 AZs, 1 NAT) + ECS Fargate cluster
///   - RDS PostgreSQL (managed) with credentials in Secrets Manager
///   - SQS FIFO queue (contoso.fifo) consumed by the notification service
///   - Web app  : public Fargate service behind an Application Load Balancer
///   - Notifications: internal Fargate service discovered via Cloud Map DNS
///   - SPA      : S3 bucket + CloudFront; /api/* is routed to the web app ALB
///
/// Container images are built from the repo Dockerfiles as CDK assets and pushed
/// to ECR automatically on `cdk deploy` (no separate build/push step).
/// </summary>
public class ContosoUniversityStack : Stack
{
    // Both .NET services listen on plain HTTP 8080 inside the container. No HTTPS
    // port is configured on purpose: UseHttpsRedirection() becomes a no-op when no
    // HTTPS port is known, so requests proxied over HTTP from the ALB are not
    // redirected. TLS is terminated at CloudFront (SPA) / can be added at the ALB.
    private const int ContainerPort = 8080;
    private const string DatabaseName = "contoso";
    private const string DatabaseUser = "contosoadmin";
    private const string CloudMapNamespace = "contoso.local";
    private const string NotificationsServiceName = "notifications";

    internal ContosoUniversityStack(Construct scope, string id, IStackProps? props = null)
        : base(scope, id, props)
    {
        // ---------------------------------------------------------------------
        // Network + compute cluster
        // ---------------------------------------------------------------------
        var vpc = new Vpc(this, "Vpc", new VpcProps
        {
            MaxAzs = 2,
            NatGateways = 1
        });

        var cluster = new Cluster(this, "Cluster", new ClusterProps
        {
            Vpc = vpc
        });

        // Private DNS namespace so the web app can reach the notification service
        // at http://notifications.contoso.local:8080.
        cluster.AddDefaultCloudMapNamespace(new CloudMapNamespaceOptions
        {
            Name = CloudMapNamespace
        });

        // ---------------------------------------------------------------------
        // SQS FIFO queue — matches the app's contoso.fifo / non-content-based dedup
        // (the service supplies its own MessageDeduplicationId).
        // ---------------------------------------------------------------------
        var queue = new Queue(this, "NotificationQueue", new QueueProps
        {
            QueueName = "contoso.fifo",
            Fifo = true,
            ContentBasedDeduplication = false
        });

        // ---------------------------------------------------------------------
        // RDS PostgreSQL — managed, private subnets, generated master secret.
        // RemovalPolicy.DESTROY + no deletion protection because this is a
        // prep/non-prod stack; harden both for production.
        // ---------------------------------------------------------------------
        var database = new DatabaseInstance(this, "Postgres", new DatabaseInstanceProps
        {
            Engine = DatabaseInstanceEngine.Postgres(new PostgresInstanceEngineProps
            {
                Version = PostgresEngineVersion.VER_16
            }),
            InstanceType = Amazon.CDK.AWS.EC2.InstanceType.Of(InstanceClass.BURSTABLE3, InstanceSize.MICRO),
            Vpc = vpc,
            VpcSubnets = new SubnetSelection { SubnetType = SubnetType.PRIVATE_WITH_EGRESS },
            Credentials = Credentials.FromGeneratedSecret(DatabaseUser),
            DatabaseName = DatabaseName,
            AllocatedStorage = 20,
            MaxAllocatedStorage = 50,
            RemovalPolicy = RemovalPolicy.DESTROY,
            DeletionProtection = false
        });

        // ---------------------------------------------------------------------
        // Web app — public, behind an ALB. Serves MVC + the REST API (/api/*).
        // Connection string is composed in the app from these discrete values;
        // the password is injected from the RDS-generated Secrets Manager secret.
        // ---------------------------------------------------------------------
        var webApp = new ApplicationLoadBalancedFargateService(this, "WebApp",
            new ApplicationLoadBalancedFargateServiceProps
            {
                Cluster = cluster,
                Cpu = 512,
                MemoryLimitMiB = 1024,
                DesiredCount = 1,
                PublicLoadBalancer = true,
                TaskImageOptions = new ApplicationLoadBalancedTaskImageOptions
                {
                    Image = ContainerImage.FromAsset("..", new AssetImageProps
                    {
                        File = "ContosoUniversity.WebApp.Dockerfile"
                    }),
                    ContainerPort = ContainerPort,
                    Environment = new Dictionary<string, string>
                    {
                        ["ASPNETCORE_ENVIRONMENT"] = "Production",
                        ["ASPNETCORE_HTTP_PORTS"] = ContainerPort.ToString(),
                        // Honor X-Forwarded-* from CloudFront/ALB for correct scheme/host.
                        ["ASPNETCORE_FORWARDEDHEADERS_ENABLED"] = "true",
                        ["DB_HOST"] = database.DbInstanceEndpointAddress,
                        ["DB_PORT"] = database.DbInstanceEndpointPort,
                        ["DB_NAME"] = DatabaseName,
                        ["DB_USER"] = DatabaseUser,
                        ["AppSettings__NotificationServiceBaseUrl"] =
                            $"http://{NotificationsServiceName}.{CloudMapNamespace}:{ContainerPort}"
                    },
                    Secrets = new Dictionary<string, Amazon.CDK.AWS.ECS.Secret>
                    {
                        ["DB_PASSWORD"] = Amazon.CDK.AWS.ECS.Secret.FromSecretsManager(database.Secret!, "password")
                    }
                }
            });

        // The app exposes /health in all environments (see ServiceDefaults); use it
        // for the ALB target health check.
        webApp.TargetGroup.ConfigureHealthCheck(new Amazon.CDK.AWS.ElasticLoadBalancingV2.HealthCheck
        {
            Path = "/health",
            HealthyHttpCodes = "200"
        });

        // ---------------------------------------------------------------------
        // Notification service — internal only, discovered via Cloud Map DNS.
        // Talks to SQS using the task role (default AWS credential chain), so we
        // deliberately do NOT set AWS__ServiceURL (that path is LocalStack-only).
        // ---------------------------------------------------------------------
        var notificationsTaskDef = new FargateTaskDefinition(this, "NotificationsTaskDef",
            new FargateTaskDefinitionProps
            {
                Cpu = 256,
                MemoryLimitMiB = 512
            });

        notificationsTaskDef.AddContainer("notifications", new ContainerDefinitionOptions
        {
            Image = ContainerImage.FromAsset("..", new AssetImageProps
            {
                File = "ContosoUniversity.NotificationService/Dockerfile"
            }),
            Logging = LogDriver.AwsLogs(new AwsLogDriverProps { StreamPrefix = "notifications" }),
            Environment = new Dictionary<string, string>
            {
                ["ASPNETCORE_ENVIRONMENT"] = "Production",
                ["ASPNETCORE_HTTP_PORTS"] = ContainerPort.ToString(),
                ["AWS_REGION"] = Region,
                ["AppSettings__SqsQueueUrl"] = queue.QueueUrl
            },
            PortMappings = new[] { new PortMapping { ContainerPort = ContainerPort } }
        });

        var notifications = new FargateService(this, "NotificationsService", new FargateServiceProps
        {
            Cluster = cluster,
            TaskDefinition = notificationsTaskDef,
            DesiredCount = 1,
            CloudMapOptions = new CloudMapOptions { Name = NotificationsServiceName }
        });

        // SQS access for the notification service (send + receive + delete).
        queue.GrantSendMessages(notificationsTaskDef.TaskRole);
        queue.GrantConsumeMessages(notificationsTaskDef.TaskRole);

        // ---------------------------------------------------------------------
        // Network rules between services
        // ---------------------------------------------------------------------
        // Web app -> RDS (5432)
        database.Connections.AllowDefaultPortFrom(webApp.Service, "web app to PostgreSQL");
        // Web app -> notification service (8080)
        notifications.Connections.AllowFrom(webApp.Service, Port.Tcp(ContainerPort), "web app to notifications");

        // ---------------------------------------------------------------------
        // SPA — S3 + CloudFront. Default behavior serves the SPA from S3; /api/*
        // is routed to the web app ALB, so the SPA keeps using relative /api URLs
        // (no CORS, no SPA code change). SPA client-side routes fall back to
        // index.html via the 403/404 custom error responses.
        // ---------------------------------------------------------------------
        var spaBucket = new Bucket(this, "SpaBucket", new BucketProps
        {
            BlockPublicAccess = BlockPublicAccess.BLOCK_ALL,
            RemovalPolicy = RemovalPolicy.DESTROY,
            AutoDeleteObjects = true
        });

        var distribution = new Distribution(this, "Spa", new DistributionProps
        {
            DefaultRootObject = "index.html",
            DefaultBehavior = new BehaviorOptions
            {
                Origin = S3BucketOrigin.WithOriginAccessControl(spaBucket),
                ViewerProtocolPolicy = ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            },
            AdditionalBehaviors = new Dictionary<string, IBehaviorOptions>
            {
                ["/api/*"] = new BehaviorOptions
                {
                    Origin = new LoadBalancerV2Origin(webApp.LoadBalancer, new LoadBalancerV2OriginProps
                    {
                        ProtocolPolicy = OriginProtocolPolicy.HTTP_ONLY
                    }),
                    ViewerProtocolPolicy = ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    AllowedMethods = AllowedMethods.ALLOW_ALL,
                    CachePolicy = CachePolicy.CACHING_DISABLED,
                    OriginRequestPolicy = OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
                }
            },
            ErrorResponses = new[]
            {
                new ErrorResponse { HttpStatus = 403, ResponseHttpStatus = 200, ResponsePagePath = "/index.html" },
                new ErrorResponse { HttpStatus = 404, ResponseHttpStatus = 200, ResponsePagePath = "/index.html" }
            }
        });

        // Build the SPA inside a Node container at deploy time and upload to S3,
        // then invalidate CloudFront. vite's outDir is overridden to the asset
        // output so we don't depend on the repo's ../wwwroot target.
        _ = new BucketDeployment(this, "SpaDeployment", new BucketDeploymentProps
        {
            Sources = new[]
            {
                Source.Asset("../ClientApp", new Amazon.CDK.AWS.S3.Assets.AssetOptions
                {
                    Bundling = new BundlingOptions
                    {
                        Image = DockerImage.FromRegistry("public.ecr.aws/docker/library/node:20"),
                        Command = new[]
                        {
                            "sh", "-c",
                            "npm ci && npx vite build --outDir /asset-output --emptyOutDir"
                        }
                    }
                })
            },
            DestinationBucket = spaBucket,
            Distribution = distribution,
            DistributionPaths = new[] { "/*" }
        });

        // ---------------------------------------------------------------------
        // Outputs
        // ---------------------------------------------------------------------
        _ = new CfnOutput(this, "SpaUrl", new CfnOutputProps
        {
            Value = $"https://{distribution.DistributionDomainName}",
            Description = "Public application URL (CloudFront — SPA + /api)"
        });
        _ = new CfnOutput(this, "WebAppAlbDns", new CfnOutputProps
        {
            Value = webApp.LoadBalancer.LoadBalancerDnsName,
            Description = "Web app ALB DNS (origin behind CloudFront)"
        });
        _ = new CfnOutput(this, "QueueUrl", new CfnOutputProps { Value = queue.QueueUrl });
        _ = new CfnOutput(this, "DbEndpoint", new CfnOutputProps { Value = database.DbInstanceEndpointAddress });
        _ = new CfnOutput(this, "DbSecretArn", new CfnOutputProps
        {
            Value = database.Secret!.SecretArn,
            Description = "Secrets Manager ARN holding the RDS master credentials"
        });
    }
}
