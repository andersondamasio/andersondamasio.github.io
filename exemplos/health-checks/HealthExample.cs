using System.Net;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

public sealed class SimulatedDependency : IHealthCheck
{
    private int status = (int)HealthStatus.Unhealthy;
    private int calls;
    public int Calls => Volatile.Read(ref calls);
    public void SetStatus(HealthStatus value) => Volatile.Write(ref status, (int)value);

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Interlocked.Increment(ref calls);
        return Task.FromResult(new HealthCheckResult((HealthStatus)Volatile.Read(ref status)));
    }
}

public static class HealthExample
{
    public static WebApplication Create(SimulatedDependency dependency)
    {
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions
        {
            Args = [], EnvironmentName = "Testing"
        });
        builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(server => server.Listen(IPAddress.Loopback, 0));
        builder.Services.AddHealthChecks()
            .AddCheck("simulated-dependency", dependency, tags: ["ready"]);

        var app = builder.Build();
        app.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = _ => false
        });
        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("ready")
        });
        return app;
    }
}
