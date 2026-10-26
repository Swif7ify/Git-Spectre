# Git-Spectre Database Architecture & Schema Specification

This document details the database schema, indexing strategies, anti-spam mechanisms, and query patterns powering the Git-Spectre Global Developer Leaderboard.

---

## 1. Architecture Overview

Git-Spectre uses an **embedded SQLite database** engine with Write-Ahead Logging (`WAL`) mode enabled. This avoids external cloud database dependencies, keeps infrastructure zero-cost and zero-configuration, and ensures sub-millisecond query execution.

### Storage Paths & Serverless Resilience
- **Local / Self-Hosted**: Persisted to `data/leaderboard.db` in the workspace root.
- **Serverless / Vercel / AWS Lambda**: Automatically detected via environment variables (`VERCEL`, `AWS_LAMBDA_FUNCTION_NAME`). When running in serverless read-only environments, SQLite storage transparently falls back to `/tmp/spectre_leaderboard.db`.

### PRAGMA Configuration
```sql
PRAGMA journal_mode = WAL;       -- High concurrency without read-write blocking
PRAGMA synchronous = NORMAL;     -- Optimal write performance with crash safety
PRAGMA foreign_keys = ON;        -- Referential integrity enforcement
```

---

## 2. Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────┐
│     leaderboard_profiles        │
├─────────────────────────────────┤
│ PK  login (TEXT NOCASE)         │◀──────┐
│     name (TEXT)                 │       │
│     avatar_url (TEXT)           │       │ (1 to N)
│     dev_score (INTEGER)         │       │
│     score_tier (TEXT)           │       │
│     archetype_title (TEXT)      │       │
│     archetype_badge (TEXT)      │       │
│     dev_level (INTEGER)         │       │
│     primary_language (TEXT)     │       │
│     public_repos (INTEGER)      │       │
│     stars_earned (INTEGER)      │       │
│     followers (INTEGER)         │       │
│     first_checked_at (REAL)     │       │
│     last_checked_at (REAL)      │       │
└─────────────────────────────────┘       │
                                          │
┌─────────────────────────────────┐       │
│         profile_checks          │       │
├─────────────────────────────────┤       │
│ PK  id (INTEGER AUTOINCREMENT)  │       │
│ FK  login (TEXT NOCASE)         ├───────┘
│     ip_hash (TEXT)              │
│     checked_at (REAL)           │
│     date_utc (TEXT)             │
│     month_utc (TEXT)            │
│     year_utc (TEXT)             │
└─────────────────────────────────┘
```

---

## 3. Table Definitions

### 3.1 `leaderboard_profiles`
Maintains the latest validated snapshot of every analyzed developer profile.

```sql
CREATE TABLE IF NOT EXISTS leaderboard_profiles (
    login             TEXT PRIMARY KEY COLLATE NOCASE,
    name              TEXT,
    avatar_url        TEXT NOT NULL,
    dev_score         INTEGER NOT NULL DEFAULT 0,
    score_tier        TEXT NOT NULL DEFAULT 'B',
    archetype_title   TEXT NOT NULL,
    archetype_badge   TEXT NOT NULL,
    dev_level         INTEGER NOT NULL DEFAULT 1,
    primary_language  TEXT NOT NULL DEFAULT '',
    public_repos      INTEGER NOT NULL DEFAULT 0,
    stars_earned      INTEGER NOT NULL DEFAULT 0,
    followers         INTEGER NOT NULL DEFAULT 0,
    first_checked_at  REAL NOT NULL,
    last_checked_at   REAL NOT NULL
);
```

| Column | Type | Constraints | Description |
|---|---|---|---|
| `login` | `TEXT` | `PRIMARY KEY COLLATE NOCASE` | GitHub username handle (case-insensitive) |
| `name` | `TEXT` | `NULLABLE` | Developer's display name |
| `avatar_url` | `TEXT` | `NOT NULL` | URL to avatar image |
| `dev_score` | `INTEGER` | `NOT NULL DEFAULT 0` | Developer Score™ (0–1000) composite |
| `score_tier` | `TEXT` | `NOT NULL DEFAULT 'B'` | Letter grade tier (`S+`, `S`, `A`, `B`, `C`, `D`, `E`) |
| `archetype_title`| `TEXT` | `NOT NULL` | Developer persona label (e.g. `Open Source Legend`) |
| `archetype_badge`| `TEXT` | `NOT NULL` | Persona emoji badge |
| `dev_level` | `INTEGER` | `NOT NULL DEFAULT 1` | Gamified developer XP level (1–50) |
| `primary_language`| `TEXT` | `NOT NULL DEFAULT ''` | Dominant programming language by repository bytes |
| `public_repos` | `INTEGER` | `NOT NULL DEFAULT 0` | Total public repositories |
| `stars_earned` | `INTEGER` | `NOT NULL DEFAULT 0` | Cumulative stargazers received across all repos |
| `followers` | `INTEGER` | `NOT NULL DEFAULT 0` | Follower count |
| `first_checked_at`| `REAL` | `NOT NULL` | Epoch timestamp when first scanned |
| `last_checked_at` | `REAL` | `NOT NULL` | Epoch timestamp of most recent verified scan |

---

### 3.2 `profile_checks`
Audit log recording every unique profile check, partitioned by UTC calendar periods.

```sql
CREATE TABLE IF NOT EXISTS profile_checks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    login       TEXT NOT NULL COLLATE NOCASE,
    ip_hash     TEXT NOT NULL,
    checked_at  REAL NOT NULL,
    date_utc    TEXT NOT NULL,
    month_utc   TEXT NOT NULL,
    year_utc    TEXT NOT NULL,
    FOREIGN KEY(login) REFERENCES leaderboard_profiles(login) ON DELETE CASCADE
);
```

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | Auto-incrementing unique check ID |
| `login` | `TEXT` | `NOT NULL COLLATE NOCASE` | Reference to `leaderboard_profiles(login)` |
| `ip_hash` | `TEXT` | `NOT NULL` | One-way salted SHA-256 digest of client IP + date |
| `checked_at` | `REAL` | `NOT NULL` | High-precision UTC epoch timestamp |
| `date_utc` | `TEXT` | `NOT NULL` | Partition key formatted as `YYYY-MM-DD` |
| `month_utc` | `TEXT` | `NOT NULL` | Partition key formatted as `YYYY-MM` |
| `year_utc` | `TEXT` | `NOT NULL` | Partition key formatted as `YYYY` |

---

## 4. Indexing & Optimization Strategy

Indexes are created specifically to optimize timeframe queries, rank generation, and anti-spam duplicate rejection:

```sql
-- Compound Unique Index for Anti-Spam: Guarantees max 1 check per IP per developer per UTC day
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_daily_check 
ON profile_checks(ip_hash, login, date_utc);

-- Timeframe Partition Query Accelerators
CREATE INDEX IF NOT EXISTS idx_checks_date  ON profile_checks(date_utc, login);
CREATE INDEX IF NOT EXISTS idx_checks_month ON profile_checks(month_utc, login);
CREATE INDEX IF NOT EXISTS idx_checks_year  ON profile_checks(year_utc, login);

-- Profile Secondary Sort & Filter Accelerators
CREATE INDEX IF NOT EXISTS idx_profile_score ON leaderboard_profiles(dev_score DESC);
CREATE INDEX IF NOT EXISTS idx_profile_lang  ON leaderboard_profiles(primary_language);
```

---

## 5. Anti-Spam & Anti-Gaming Architecture

To prevent scripts or malicious bots from artificially inflating a developer's ranking, Git-Spectre enforces a **defense-in-depth security model**:

### 1. Database-Enforced Unique Constraint (`idx_unique_daily_check`)
- The primary line of defense is the SQLite compound unique index: `(ip_hash, login, date_utc)`.
- When `/api/analyze` is requested, the check is inserted via `INSERT OR IGNORE`.
- If an automated script executes 1,000 requests for `@torvalds` from the same IP within the same UTC day, **only the first request records a check**. The remaining 999 requests return full profile analyses but increment 0 database check counts.

### 2. Salted SHA-256 IP Hashing (`_hash_client_ip`)
- **GDPR / Privacy Compliance**: Raw client IP addresses are never persisted to disk.
- Client IPs are hashed with a daily rotating salt:
  ```python
  salt = os.getenv("LEADERBOARD_SALT", "git-spectre-anti-gaming-salt-v3")
  raw = f"{salt}:{client_ip}:{date_str}"
  return hashlib.sha256(raw.encode("utf-8")).hexdigest()
  ```
- Cross-day tracking is mathematically impossible because the date partition forms part of the preimage.

### 3. Developer Eligibility Gatekeeper (`is_profile_eligible`)
- Automated bots and automated CI accounts are excluded:
  - Account `type` equals `Bot` or `Organization`.
  - Username ends with `[bot]`.
- Hollow or empty accounts with zero Developer Score™, zero public repos, and zero followers are excluded from ranking tables.

### 4. API Gateway Rate Limiting
- `POST /api/analyze`: Max 20 requests/minute per client IP via SlowAPI.
- `GET /api/leaderboard`: Max 30 requests/minute per client IP.

---

## 6. Query Specifications

### 6.1 Leaderboard Ranking Query
Ranks profiles across a given timeframe (`daily`, `monthly`, `yearly`, `all`) with secondary tie-breakers:

```sql
SELECT 
    p.login, p.name, p.avatar_url, p.dev_score, p.score_tier,
    p.archetype_title, p.archetype_badge, p.dev_level,
    p.primary_language, p.public_repos, p.stars_earned, p.followers,
    p.last_checked_at,
    COUNT(c.id) AS check_count
FROM profile_checks c
JOIN leaderboard_profiles p ON c.login = p.login
WHERE c.date_utc = ?  -- (or c.month_utc = ?, or c.year_utc = ?)
GROUP BY c.login
ORDER BY check_count DESC, p.dev_score DESC, p.stars_earned DESC
LIMIT ?;
```

### 6.2 Profile Rank Lookup Query
Calculates a developer's global position using SQL window functions (`ROW_NUMBER()`):

```sql
WITH ranked AS (
    SELECT 
        c.login,
        COUNT(c.id) AS check_count,
        ROW_NUMBER() OVER (
            ORDER BY COUNT(c.id) DESC, p.dev_score DESC, p.stars_earned DESC
        ) AS rank_num
    FROM profile_checks c
    JOIN leaderboard_profiles p ON c.login = p.login
    WHERE c.date_utc = ?
    GROUP BY c.login
)
SELECT rank_num, check_count FROM ranked WHERE LOWER(login) = ?;
```

### 6.3 Dynamic Languages Aggregation Query
Aggregates distinct primary languages and developer counts across tracked profiles:

```sql
SELECT primary_language, COUNT(*) AS count
FROM leaderboard_profiles
WHERE primary_language IS NOT NULL AND TRIM(primary_language) != ''
GROUP BY primary_language
ORDER BY count DESC, primary_language ASC;
```
*Note*: Cached in-memory via `core/cache.py` (`leaderboard:languages`) and automatically invalidated when new profile checks are committed to eliminate redundant table scans.

---

## 7. Migration & Backup Policy

1. **Automatic Schema Migration**: `init_leaderboard_db()` is automatically invoked upon server startup (`main.py:lifespan`). It uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` for idempotent schema deployment.
2. **Backups**: Standard SQLite backup API or file-level snapshots of `data/leaderboard.db` (when using WAL mode, ensure `leaderboard.db-wal` and `leaderboard.db-shm` are copied together, or use `sqlite3 data/leaderboard.db ".backup backup.db"`).
