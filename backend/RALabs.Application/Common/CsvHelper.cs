using System.Text;

namespace RALabs.Application.Common;

/// <summary>RFC-4180-style CSV primitives shared by the import/export flows.</summary>
public static class CsvHelper
{
    public static string Escape(string value) => value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r')
        ? $"\"{value.Replace("\"", "\"\"")}\""
        : value;

    public static string[] ParseLine(string line)
    {
        var values = new List<string>();
        var value = new StringBuilder();
        var quoted = false;
        for (var index = 0; index < line.Length; index++)
        {
            var character = line[index];
            if (character == '"')
            {
                if (quoted && index + 1 < line.Length && line[index + 1] == '"') { value.Append('"'); index++; }
                else quoted = !quoted;
            }
            else if (character == ',' && !quoted) { values.Add(value.ToString()); value.Clear(); }
            else value.Append(character);
        }
        values.Add(value.ToString());
        return values.ToArray();
    }
}
