DROP TABLE IF EXISTS articles, users, organizations;

CREATE TABLE organizations (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    organization_id INT NOT NULL REFERENCES organizations(id),
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'user',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE articles (
    id              SERIAL PRIMARY KEY,
    organization_id INT NOT NULL REFERENCES organizations(id),
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    url             TEXT,
    source          TEXT NOT NULL,
    author          TEXT,
    sentiment       TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    published_at    TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_articles_org_sentiment_source_published
ON articles (organization_id, sentiment, source, published_at DESC, id DESC)
WHERE deleted_at IS NULL;

