/**
 * isSqlInjection(input) -> boolean
 * Returns true if the input string contains suspicious SQL-injection patterns.
 *
 * Heuristic checks:
 *  - SQL keywords used in suspicious contexts (union select, drop table, etc.)
 *  - SQL comment tokens (--, /* ... *\/)
 *  - Tautologies or always-true payloads (or 1=1, '1'='1', etc.)
 *  - Stacked queries / semicolons
 *  - Hex-encoded payloads and common function calls (char(), cast(), exec(), etc.)
 *
 * Note: This is only a detector for suspicious strings. Do NOT rely on this
 * for real security — use parameterized queries / prepared statements.
 */
function isSqlInjection(input) {
    if (typeof input !== "string") return false;
    const s = input.toLowerCase();

    // Quick safe-guard: very long SQL-like payloads are suspicious
    if (s.length > 1000) return true;

    // Common SQL-injection indicators (heuristic)
    const patterns = [
        // tautologies
        /\bor\s+1\s*=\s*1\b/,
        /' *or *'1' *= *'1'/,
        /" *or *"1" *= *"1"/,
        /\b1\s*=\s*1\b/,

        // union/select data extraction
        /\bunion(\s+all)?\s+select\b/,
        /\bselect\b.+\bfrom\b/,

        // stacked queries / statement terminators
        /;.+\b(drop|insert|update|delete|select|alter|create)\b/,
        /; *$/,

        // comments
        /--/, // SQL single-line comment
        /\/\*/, // start of C-style comment
        /\*\//, // end of C-style comment

        // exec/execute and common functions used in payloads
        /\b(exec|execute|sp_executesql|xp_cmdshell)\b/,
        /\b(char|nchar|varchar|nvarchar|cast|convert)\s*\(/,

        // meta-characters & encoded payloads
        /0x[0-9a-f]{2,}/, // hex blobs like 0x414141
        /%27|%22|%3b|%2d%2d/, // url-encoded ' " ; --

        // destructive keywords
        /\b(drop|truncate|delete|update|insert|alter|create|shutdown|kill)\b/,

        // attempt to read system tables or metadata
        /\b(information_schema|pg_catalog|sysobjects|sys.tables)\b/,

        // common bypass patterns
        /\bor\s+'?\/\*'?\s*=\s*'?\/*'?/, // messy, catches some obfuscations
    ];

    for (const re of patterns) {
        if (re.test(s)) return true;
    }

    // check for many keywords in one string (suspicious combined presence)
    const suspiciousKeywords = [
        "select",
        "union",
        "insert",
        "update",
        "delete",
        "drop",
        "alter",
        "create",
        "exec",
        "cast",
        "declare",
        "shutdown",
    ];
    let count = 0;
    for (const kw of suspiciousKeywords) {
        if (s.includes(kw)) count++;
        if (count >= 3) return true; // 3+ SQL keywords is suspicious
    }

    return false;
}

module.exports = { isSqlInjection };