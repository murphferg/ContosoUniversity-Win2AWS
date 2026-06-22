# Deploying Contoso University to AWS

This deploys the app to **Amazon ECS Fargate** with images in **ECR**, **RDS for
PostgreSQL**, an **SQS FIFO** queue, and the React SPA on **S3 + CloudFront** —
all defined as an **AWS CDK** app (C#) under [`infra/`](infra/).

> Nothing here deploys automatically. These are the steps you run when ready.

## Architecture

```
                    ┌──────────────── CloudFront ────────────────┐
   Browser ──https──▶  default behavior  ──▶ S3 (SPA static site) │
                    │  /api/*  behavior   ──▶ ALB ─▶ Web app (Fargate)
                    └─────────────────────────────────────────────┘
                                                     │  http://notifications.contoso.local:8080
                                                     ▼
                                          Notification svc (Fargate, internal)
                                                     │
                              Web app ─▶ RDS PostgreSQL        └─▶ SQS  contoso.fifo
```

- **Web app** — public Fargate service behind an ALB; serves MVC + `/api/*`.
- **Notification service** — internal Fargate service, found via Cloud Map DNS
  (`notifications.contoso.local`); talks to SQS via its **task role** (no static keys).
- **SPA** — built and uploaded to S3; CloudFront serves it and routes `/api/*` to
  the ALB, so the SPA keeps using relative `/api` URLs (no CORS, no SPA change).
- **Postgres** — RDS managed instance; master credentials in Secrets Manager.

## Prerequisites

| Tool | Notes |
|------|-------|
| AWS account + credentials | `aws configure` or SSO; rights to create VPC, ECS, ECR, RDS, SQS, S3, CloudFront, IAM, Secrets Manager |
| AWS CLI | `aws sts get-caller-identity` should succeed |
| .NET 8 SDK | builds the CDK app and the service images |
| Node.js 20+ | only if building the SPA outside Docker; CDK builds it in a container by default |
| Docker | required — CDK builds the service images **and** the SPA bundle locally |
| AWS CDK CLI | `npm install -g aws-cdk` (the `cdk` command) |

## One-time bootstrap

CDK needs a bootstrap stack per account/region (creates the asset S3 bucket + the
ECR repo that image assets are pushed to):

```bash
cd infra
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=us-east-1          # or your region
cdk bootstrap
```

## Deploy

```bash
cd infra
cdk synth      # optional: render the CloudFormation template, validate
cdk deploy     # builds images → pushes to ECR → provisions everything → deploys
```

On `cdk deploy` CDK will:
1. Build `ContosoUniversity.WebApp.Dockerfile` and
   `ContosoUniversity.NotificationService/Dockerfile` and push both images to ECR.
2. Build the SPA in a Node container and upload it to the S3 bucket.
3. Provision the VPC, ECS cluster, RDS, SQS, ALB, CloudFront, IAM roles, secrets.
4. Print outputs, including **`SpaUrl`** (the public CloudFront URL).

## How configuration is wired (no secrets in code)

| Setting | Source at runtime |
|---------|-------------------|
| `ConnectionStrings:DefaultConnection` | Composed in `Program.cs` from `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER` (env) + `DB_PASSWORD` (Secrets Manager → ECS secret) |
| `AppSettings:NotificationServiceBaseUrl` | `http://notifications.contoso.local:8080` (Cloud Map DNS) |
| `AppSettings:SqsQueueUrl` | The provisioned `contoso.fifo` queue URL |
| AWS credentials / region | ECS **task role** + `AWS_REGION` (no access keys; `AWS__ServiceURL` is *not* set, so the SDK targets real AWS) |

## Post-deploy checks

1. Open the **`SpaUrl`** output → confirm the SPA loads and client-side routing works.
2. Exercise a create/edit → confirm the **notification flow** reaches `contoso.fifo`
   (CloudWatch logs for the `notifications` service).
3. The schema is created and seeded on first web-app start via `DbInitializer`
   (`EnsureCreated()`), against RDS.

## Teardown

```bash
cd infra
cdk destroy
```

The bucket (`AutoDeleteObjects`) and RDS (`RemovalPolicy.DESTROY`) are removed.

## Caveats / hardening before production

- **Single task each** (`DesiredCount = 1`). `EnsureCreated()` seeding runs on web-app
  start; if you scale out, guard initialization or switch to migrations.
- **CloudFront → ALB origin is HTTP.** Lock the ALB to CloudFront (custom header or
  the CloudFront managed prefix list) and/or terminate TLS at the ALB with ACM.
- **RDS TLS**: the app uses `SslMode=Require` (encrypted, no CA validation). For
  production use `VerifyFull` with the RDS CA bundle.
- **RDS removal policy is DESTROY** and deletion protection is off — flip both for prod.
- The standalone `infra/` project is **not** in `ContosoUniversity.sln` by design.
