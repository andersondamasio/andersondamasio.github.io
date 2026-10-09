public static class Reservoir
{
    public static List<T> Sample<T>(IEnumerable<T> source, int size, Random? random = null)
    {
        ArgumentNullException.ThrowIfNull(source);
        ArgumentOutOfRangeException.ThrowIfNegative(size);
        var sample = new List<T>();
        if (size == 0) return sample;

        random ??= Random.Shared;
        long seen = 0;
        foreach (var item in source)
        {
            seen = checked(seen + 1);
            if (sample.Count < size)
            {
                sample.Add(item);
                continue;
            }

            // Algorithm R: select a position among all items seen, not only the reservoir.
            long position = random.NextInt64(seen);
            if (position < size) sample[(int)position] = item;
        }
        return sample;
    }
}
