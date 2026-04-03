CREATE TABLE IF NOT EXISTS events (
  event_id     UUID DEFAULT generateUUIDv4(),
  site_id      String,
  event_type   Enum8('pageview'=1, 'click'=2, 'custom'=3),
  url          String,
  referrer     String,
  user_agent   String,
  ip_hash      FixedString(64),
  country      LowCardinality(String),
  city         String,
  lat          Float32,
  lon          Float32,
  click_x      Float32,
  click_y      Float32,
  session_id   String,
  is_bot       Bool DEFAULT false,
  timestamp    DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (site_id, timestamp)
TTL timestamp + INTERVAL 1 YEAR;

CREATE MATERIALIZED VIEW IF NOT EXISTS events_by_minute
ENGINE = SummingMergeTree()
ORDER BY (site_id, minute, url)
AS SELECT
  site_id,
  toStartOfMinute(timestamp) AS minute,
  url,
  count() AS pageviews,
  countIf(event_type = 'click') AS clicks,
  uniqExact(session_id) AS sessions
FROM events
WHERE is_bot = false
GROUP BY site_id, minute, url;

CREATE MATERIALIZED VIEW IF NOT EXISTS top_referrers
ENGINE = SummingMergeTree()
ORDER BY (site_id, referrer)
AS SELECT
  site_id,
  referrer,
  count() AS hits
FROM events
WHERE is_bot = false AND referrer != ''
GROUP BY site_id, referrer;
