# Web app (MVC + REST API) container image.
# Build context is the REPO ROOT so the ServiceDefaults project reference resolves.
# The React SPA is NOT built into this image — it is hosted on S3/CloudFront.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Restore against just the csproj files first for better layer caching.
COPY ["ContosoUniversity.csproj", "./"]
COPY ["ContosoUniversity.ServiceDefaults/ContosoUniversity.ServiceDefaults.csproj", "ContosoUniversity.ServiceDefaults/"]
RUN dotnet restore "ContosoUniversity.csproj"

COPY . .
RUN dotnet publish "ContosoUniversity.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_HTTP_PORTS=8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ContosoUniversity.dll"]
