# RALabs API — multi-stage .NET 8 build → runtime
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY backend/RALabs.sln ./
COPY backend/RALabs.Domain/RALabs.Domain.csproj backend/RALabs.Domain/
COPY backend/RALabs.Application/RALabs.Application.csproj backend/RALabs.Application/
COPY backend/RALabs.Infrastructure/RALabs.Infrastructure.csproj backend/RALabs.Infrastructure/
COPY backend/RALabs.Api/RALabs.Api.csproj backend/RALabs.Api/
COPY backend/RALabs.Tests/RALabs.Tests.csproj backend/RALabs.Tests/
RUN dotnet restore backend/RALabs.Api/RALabs.Api.csproj
COPY backend/ backend/
RUN dotnet publish backend/RALabs.Api/RALabs.Api.csproj -c Release -o /app/out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/out ./
ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=0
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8080/health || exit 1
ENTRYPOINT ["dotnet", "RALabs.Api.dll"]
