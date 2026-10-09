using System.Text.Json;

var results = new List<string>();
void Check(string name, Action run)
{
    run();
    results.Add(name);
}
void Equal<T>(IEnumerable<T> actual, params T[] expected)
{
    if (!actual.SequenceEqual(expected)) throw new Exception("Unexpected sequence.");
}
void Throws<T>(Action run) where T : Exception
{
    try { run(); } catch (T) { return; }
    throw new Exception($"Expected {typeof(T).Name}.");
}

Check("legacy-size-greater-than-input-reproduces-error", () =>
    Throws<IndexOutOfRangeException>(() => LegacySample([1, 2], 3)));
Check("empty-source", () => Equal(Reservoir.Sample(Array.Empty<int>(), 3)));
Check("sample-larger-than-source-returns-all", () => Equal(Reservoir.Sample(new[] { 1, 2 }, 3), 1, 2));
Check("sample-equal-to-source", () => Equal(Reservoir.Sample(new[] { 1, 2 }, 2), 1, 2));
Check("zero-does-not-enumerate", () => Equal(Reservoir.Sample(FailIfEnumerated(), 0)));
Check("negative-size", () => Throws<ArgumentOutOfRangeException>(() => Reservoir.Sample(new[] { 1 }, -1)));
Check("null-source", () => Throws<ArgumentNullException>(() => Reservoir.Sample<int>(null!, 1)));
Check("deterministic-replacement", () => Equal(Reservoir.Sample(new[] { 1, 2, 3, 4 }, 2, new Choices(0, 1)), 3, 4));
Check("exclusive-upper-bound", () => Equal(Reservoir.Sample(new[] { 1, 2, 3, 4 }, 2, new Choices(2, 3)), 1, 2));
Check("same-seed-same-runtime", () => Equal(Reservoir.Sample(Enumerable.Range(0, 100), 10, new Random(42)),
    Reservoir.Sample(Enumerable.Range(0, 100), 10, new Random(42)).ToArray()));
Check("stream-enumerated-once", () =>
{
    int passes = 0;
    IEnumerable<int> Source()
    {
        if (++passes != 1) throw new Exception("Second pass.");
        for (int i = 0; i < 100; i++) yield return i;
    }
    var sample = Reservoir.Sample(Source(), 7, new Random(42));
    if (sample.Count != 7 || sample.Distinct().Count() != 7 || sample.Any(i => i < 0 || i >= 100))
        throw new Exception("Invalid sample.");
});
Check("equal-values-are-different-input-positions", () => Equal(Reservoir.Sample(new[] { 9, 9 }, 2), 9, 9));
Check("all-small-case-paths-have-uniform-subsets", () =>
{
    var counts = new Dictionary<string, int>();
    for (int third = 0; third < 3; third++)
    for (int fourth = 0; fourth < 4; fourth++)
    {
        var sample = Reservoir.Sample(new[] { 1, 2, 3, 4 }, 2, new Choices(third, fourth));
        string key = string.Join(",", sample.Order());
        counts[key] = counts.GetValueOrDefault(key) + 1;
    }
    if (counts.Count != 6 || counts.Values.Any(count => count != 2))
        throw new Exception("Small-case distribution differs from Algorithm R.");
});

Console.WriteLine(JsonSerializer.Serialize(new {
    runtime = Environment.Version.ToString(), passed = results.Count, tests = results,
    scope = "Isolated executable checks, not a benchmark or field result."
}, new JsonSerializerOptions { WriteIndented = true }));

static IEnumerable<int> FailIfEnumerated()
{
    throw new Exception("Zero-size sample should not consume input.");
#pragma warning disable CS0162
    yield break;
#pragma warning restore CS0162
}

static List<int> LegacySample(int[] stream, int k)
{
    var reservoir = new List<int>();
    for (int i = 0; i < k; i++) reservoir.Add(stream[i]);
    var random = new Random();
    for (int i = k; i < stream.Length; i++)
    {
        int j = random.Next(0, i + 1);
        if (j < k) reservoir[j] = stream[i];
    }
    return reservoir;
}

sealed class Choices(params long[] values) : Random
{
    private int offset;
    public override long NextInt64(long maxValue)
    {
        if (offset >= values.Length) throw new Exception("Unexpected random draw.");
        long result = values[offset++];
        if (result < 0 || result >= maxValue) throw new Exception("Invalid exclusive bound.");
        return result;
    }
}
