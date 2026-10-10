using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.Diagnostics.HealthChecks;

var dependency = new SimulatedDependency();
await using var app = HealthExample.Create(dependency);
var results = new List<object>();
try
{
    using var startupDeadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
    await app.StartAsync(startupDeadline.Token);
    var server = app.Services.GetRequiredService<IServer>();
    var address = server.Features.Get<IServerAddressesFeature>()!.Addresses.Single();
    using var client = new HttpClient { BaseAddress = new Uri(address), Timeout = TimeSpan.FromSeconds(10) };

    foreach (var phase in new[]
    {
        (Name: "initially-unready", Status: HealthStatus.Unhealthy),
        (Name: "ready", Status: HealthStatus.Healthy),
        (Name: "degraded", Status: HealthStatus.Degraded),
        (Name: "dependency-failed", Status: HealthStatus.Unhealthy),
        (Name: "recovered", Status: HealthStatus.Healthy)
    })
    {
        dependency.SetStatus(phase.Status);
        int before = dependency.Calls;
        await Check(phase.Name, "/health/live", HttpStatusCode.OK, "Healthy");
        if (dependency.Calls != before) throw new Exception("Liveness ran the dependency check.");

        var expected = phase.Status == HealthStatus.Unhealthy
            ? HttpStatusCode.ServiceUnavailable : HttpStatusCode.OK;
        await Check(phase.Name, "/health/ready", expected, phase.Status.ToString());
        if (dependency.Calls != before + 1) throw new Exception("Readiness did not run exactly one check.");
    }

    using var missing = await client.GetAsync("/not-a-health-route");
    if (missing.StatusCode != HttpStatusCode.NotFound) throw new Exception("Unknown route was successful.");
    results.Add(new { phase = "unknown-route", path = "/not-a-health-route", status = 404 });

    Console.WriteLine(JsonSerializer.Serialize(new
    {
        runtime = Environment.Version.ToString(), passed = results.Count, dependencyChecks = dependency.Calls,
        scope = "Local HTTP checks with a simulated dependency. No business transaction or production incident tested.",
        results
    }, new JsonSerializerOptions { WriteIndented = true }));

    async Task Check(string phase, string path, HttpStatusCode expected, string body)
    {
        using var response = await client.GetAsync(path);
        string actualBody = await response.Content.ReadAsStringAsync();
        if (response.StatusCode != expected || actualBody != body)
            throw new Exception($"{phase} {path}: {(int)response.StatusCode} {actualBody}");
        if (response.Headers.CacheControl?.NoStore != true)
            throw new Exception("Health response permits storage in a cache.");
        results.Add(new { phase, path, status = (int)response.StatusCode, body = actualBody });
    }
}
finally
{
    using var shutdownDeadline = new CancellationTokenSource(TimeSpan.FromSeconds(5));
    await app.StopAsync(shutdownDeadline.Token);
}
