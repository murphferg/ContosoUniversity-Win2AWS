# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Contoso University, the classic ASP.NET MVC tutorial app, **migrated from .NET Framework 4.8.2 / MVC 5 to .NET 8** and re-platformed as a distributed app orchestrated by **.NET Aspire 13.4**. The migration added a React SPA front-end, a REST API layer, and an SQS-backed notification microservice.

> ⚠️ **`README.md` is stale** — it still describes the original .NET Framework 4.8.2 / EF Core 3.1 / SQL Server LocalDB / MSMQ version. Ignore it for anything about how the app is built or run today. This file reflects the current state.

## Projects

| Project | TFM | Role |
|---|---|---|
| `ContosoUniversity` (root) | net8.0 | Web app: MVC (Razor) + REST API (`/api/*`) + SPA host |
| `ContosoUniversity.NotificationService` | net8.0 | Microservice that publishes/consumes notifications via AWS SQS |
| `ContosoUniversity.ServiceDefaults` | net8.0 | Shared Aspire defaults (OpenTelemetry, health checks, HTTP resilience, service discovery) — referenced by both services |
| `ContosoUniversity.AppHost` | **net10.0** | Aspire orchestrator (the entry point for local dev) |
| `ClientApp/` | — | React 18 + TypeScript + Vite SPA (not in the .sln; built/run via npm or Aspire) |

## Running & building

**Run the whole system via Aspire** (starts Postgres + LocalStack containers, both .NET services, and the Vite dev server, all wired together):

```bash
aspire run                                      # from repo root (preferred; uses the aspire CLI)
dotnet run --project ContosoUniversity.AppHost  # equivalent without the CLI
```

This requires **Docker** (for the Postgres and LocalStack containers) and the **.NET 10 SDK** (AppHost targets net10.0; the services target net8.0). For Aspire lifecycle, resource, deploy, and monitoring tasks, use the `aspire` skill — do not hand-roll container or process management.

```bash
dotnet build ContosoUniversity.sln    # build all .NET projects
cd ClientApp && npm install            # restore SPA deps
cd ClientApp && npm run dev            # Vite dev server (port 3000) — Aspire does this for you
cd ClientApp && npm run build          # tsc -b && vite build → outputs to ../wwwroot
cd ClientApp && npm run lint           # eslint
```

**There is no test project** in this repo — there are no unit/integration tests to run.

## Architecture & cross-cutting concepts

**Aspire orchestration** (`ContosoUniversity.AppHost/AppHost.cs`) is the source of truth for how services connect. It declares: a persistent Postgres container with database `contoso`, a LocalStack container emulating AWS SQS, the notification service, the web app, and the Vite SPA. Connection strings and service URLs are injected into each service as environment variables (e.g. `ConnectionStrings__DefaultConnection`, `AppSettings__NotificationServiceBaseUrl`, `AWS__ServiceURL`) — **prefer wiring new config through the AppHost over hardcoding it** in `appsettings.json`. The `appsettings.json` values are fallbacks for running a service standalone.

**Two front-end paths coexist in the web app:**
- **REST API** (`Controllers/Api/*ApiController.cs`) — `[ApiController]` classes under `/api/*`, consumed by the React SPA. Use `DTOs/*` records for request/response shapes; never expose EF entities directly. Validation errors return a `{ "field": ["msg"] }` dictionary (see `ValidationProblemResponse`), which `ClientApp/src/apiClient.ts` parses into `ApiError`.
- **Legacy MVC** (`Controllers/*Controller.cs` + Razor `Views/`) — the original server-rendered controllers, several inheriting `BaseController`. Still present but the SPA is the active UI.

**SPA hosting / dev proxy** is bidirectional and easy to misconfigure:
- In **development**, `SpaFallbackMiddleware` proxies any non-`/api`, non-static GET request from the web app to the Vite dev server at `localhost:3000`; meanwhile `ClientApp/vite.config.ts` proxies `/api` calls back to the web app at `https://localhost:50326`.
- In **production**, `SpaFallbackMiddleware` serves `wwwroot/index.html` (the Vite build output) instead.
- The web app's HTTPS port `50326` (`Properties/launchSettings.json`) and Vite's port `3000` are hardcoded on both sides — keep them in sync if you change either.

**Notification flow** (fire-and-forget, must never block or fail a CRUD operation):
`API/MVC controller` → `NotificationClient` (typed `HttpClient`, `Services/NotificationClient.cs`) → HTTP `POST /api/notifications` on the **NotificationService** → `NotificationService.SendNotificationAsync` → **SQS FIFO queue** (`contoso.fifo`). Reads pull-and-delete from the same queue. Locally the queue lives in LocalStack and is created idempotently on service startup (`EnsureLocalStackQueueAsync` in the service's `Program.cs`); against real AWS the configured `AppSettings:SqsQueueUrl` is used as-is. Notification sends in controllers are wrapped in `Task.Run` + swallowed exceptions on purpose.

**Data layer**: EF Core 9 with **Npgsql/PostgreSQL** (the migration swapped SQL Server for Postgres). `Data/SchoolContext.cs` is the `DbContext`; `Data/DbInitializer.cs` calls `EnsureCreated()` and seeds sample data on first run. **There are no EF migrations** — the schema is created via `EnsureCreated()`, so model changes require dropping/recreating the database (delete the Postgres data volume) rather than `dotnet ef migrations add`. `SchoolContextFactory` exists for design-time tooling.

## Conventions

- New API endpoints: add an `*ApiController` under `Controllers/Api/`, define DTO records in `DTOs/`, and return validation errors via the existing dictionary format so the SPA's `apiClient.ts` handles them.
- JSON uses **Newtonsoft.Json** with round-trip date format (`"O"`) in both the web app and the notification service — match that when (de)serializing notifications.
- `ServiceDefaults` is shared infra; changes there affect telemetry/health/resilience for every service.
- The `.kiro/specs/` directory documents the migration specs (spa-migration, sqs-notifications, notification-microservice) — useful background, not active config.
