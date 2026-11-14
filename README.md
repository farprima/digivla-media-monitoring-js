# Digivla Media Monitoring - Articles API

Articles API untuk platform **Media Intelligence Monitoring**. Aplikasinya multi-tenant: setiap organisasi hanya bisa melihat dan mengelola artikelnya sendiri.

Dibuat untuk Case Study Digivla Soal 1 (dengan catatan performa untuk Soal 2).

## Deliverables

| Deliverable | Lokasi |
| --- | --- |
| Database migration / schema | [`schema.sql`](schema.sql), data awal di [`seed.sql`](seed.sql) |
| ERD | [ERD](#erd), sumbernya [`schema.dbml`](schema.dbml) |
| Dokumentasi API | [Daftar endpoint](#daftar-endpoint) dan Postman collection [`postman/Articles_API.postman_collection.json`](postman/Articles_API.postman_collection.json) |
| Automated test | Test di Postman collection yang sama, lihat [Automated test](#dokumentasi-api-dan-automated-test) |
| Architecture diagram | [Arsitektur](#arsitektur) |
| Daftar endpoint | [Daftar endpoint](#daftar-endpoint) |

## Tech stack

- Node.js, Express (CommonJS)
- PostgreSQL dengan library `pg`
- `bcrypt` untuk hash password, `jsonwebtoken` untuk JWT
- Postman untuk dokumentasi API dan automated test

## Struktur project

```
.
├── app.js                    # Express app: semua route /api/articles, validateArticle, parseId
├── db.js                     # koneksi PostgreSQL (pg)
├── src/
│   ├── middleware/
│   │   └── auth.js           # authenticate dan authorize
│   └── routes/
│       └── authRoutes.js     # POST /api/auth/login
├── schema.sql                # tabel dan index
├── seed.sql                  # data awal untuk development
├── schema.dbml               # sumber ERD untuk dbdiagram.io
├── postman/
│   └── Articles_API.postman_collection.json   # dokumentasi API + automated test
├── .env.example              # salin ke .env (.env tidak di-commit)
└── package.json
```

## Cara menjalankan

Kebutuhan: Node.js dan PostgreSQL.

```bash
npm install
cp .env.example .env                              # lalu isi DATABASE_URL dan JWT_SECRET
set -a; . ./.env; set +a                          # muat isi .env ke shell
psql "$DATABASE_URL" -f schema.sql -f seed.sql
npm start                                         # atau npm run dev untuk auto-reload
```

Server berjalan di port **3000**.

`schema.sql` menghapus tabel lama dulu (`DROP TABLE IF EXISTS`), jadi perintah `psql` di atas juga dipakai untuk mereset data ke kondisi seed.

### Environment variable

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | Connection string PostgreSQL yang dipakai `db.js`, misalnya `postgresql://user:password@localhost:5432/media_intelligence` |
| `JWT_SECRET` | Secret untuk menandatangani dan memverifikasi JWT |

## Database schema

### organizations

| Kolom | Tipe | Constraint |
| --- | --- | --- |
| `id` | `SERIAL` | primary key |
| `name` | `TEXT` | `NOT NULL` |
| `status` | `TEXT` | `NOT NULL DEFAULT 'active'` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

### users

| Kolom | Tipe | Constraint |
| --- | --- | --- |
| `id` | `SERIAL` | primary key |
| `organization_id` | `INT` | `NOT NULL`, FK ke `organizations(id)` |
| `name` | `TEXT` | `NOT NULL` |
| `email` | `TEXT` | `NOT NULL UNIQUE` |
| `password_hash` | `TEXT` | `NOT NULL`, hash bcrypt |
| `role` | `TEXT` | `NOT NULL DEFAULT 'user'`, isinya `admin` atau `user` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |

### articles

| Kolom | Tipe | Constraint |
| --- | --- | --- |
| `id` | `SERIAL` | primary key |
| `organization_id` | `INT` | `NOT NULL`, FK ke `organizations(id)` |
| `title` | `TEXT` | `NOT NULL` |
| `content` | `TEXT` | `NOT NULL` |
| `url` | `TEXT` | |
| `source` | `TEXT` | `NOT NULL` |
| `author` | `TEXT` | |
| `sentiment` | `TEXT` | `NOT NULL`, `CHECK (sentiment IN ('positive','neutral','negative'))` |
| `published_at` | `TIMESTAMPTZ` | `NOT NULL` |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT now()` |
| `deleted_at` | `TIMESTAMPTZ` | penanda soft delete |

Index:

```sql
CREATE INDEX idx_articles_org_sentiment_source_published
  ON articles (organization_id, sentiment, source, published_at DESC, id DESC)
  WHERE deleted_at IS NULL;
```

Relasi: satu organisasi punya banyak users, dan satu organisasi punya banyak articles.

## ERD

Sumbernya [`schema.dbml`](schema.dbml), yang bisa dibuka di [dbdiagram.io](https://dbdiagram.io).

```mermaid
erDiagram
    organizations ||--o{ users : has
    organizations ||--o{ articles : owns

    organizations {
        int id PK
        text name
        text status "default active"
        timestamptz created_at
        timestamptz updated_at
    }

    users {
        int id PK
        int organization_id FK
        text name
        text email UK
        text password_hash "hash bcrypt"
        text role "admin atau user"
        timestamptz created_at
        timestamptz updated_at
    }

    articles {
        int id PK
        int organization_id FK
        text title
        text content
        text url
        text source
        text author
        text sentiment "positive, neutral, negative"
        timestamptz published_at
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at "soft delete"
    }
```

## Arsitektur

```mermaid
flowchart LR
    C[Client / Postman] -->|HTTP + Bearer JWT| A[Express app.js]
    A --> M[middleware authenticate + authorize]
    M --> R[Route articles + validasi]
    R --> DB[(PostgreSQL)]
    C -->|POST /api/auth/login| L[authRoutes.js]
    L -->|bcrypt compare, sign JWT| DB
```

## Authentication dan authorization

- `POST /api/auth/login` mengembalikan JWT. Payload-nya: `id`, `organization_id`, `role`.
- Semua request ke `/api/articles` wajib membawa header `Authorization: Bearer <token>`.
- `organization_id` selalu diambil dari token, tidak pernah dari request body.
- `POST`, `PUT`, dan `DELETE` hanya untuk admin (`authorize('admin')`). Role `user` hanya bisa membaca.
- Artikel milik organisasi lain mengembalikan `404`, jadi API tidak membocorkan bahwa artikel itu ada.

### Akun seed (khusus development)

| Email | Organisasi | Role | Password |
| --- | --- | --- | --- |
| `admin1@example.com` | 1 (Digivla) | admin | `password123` |
| `user1@example.com` | 1 (Digivla) | user | `password123` |
| `admin2@example.com` | 2 (Klien B) | admin | `password123` |

Login dengan body `{ "email": "...", "password": "..." }`.

## Daftar endpoint

| Method | Path | Keterangan | Sukses | Akses |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | Login dan mendapatkan JWT | 200 | Public |
| GET | `/api/articles` | List dengan pagination, search, filter, dan sorting | 200 | Semua role |
| GET | `/api/articles/:id` | Detail artikel | 200 | Semua role |
| POST | `/api/articles` | Membuat artikel | 201 | Admin |
| PUT | `/api/articles/:id` | Full replace (semua field wajib) | 200 | Admin |
| DELETE | `/api/articles/:id` | Soft delete | 204 | Admin |

### Query parameter `GET /api/articles`

| Parameter | Keterangan |
| --- | --- |
| `page` | Default 1, minimal 1 |
| `limit` | Default 10, maksimal 100 |
| `search` | `ILIKE` pada `title` atau `content` |
| `sentiment` | Exact match, case-insensitive (input dinormalisasi ke lowercase) |
| `source` | Exact match, case-insensitive (input dinormalisasi ke lowercase) |
| `startPublish`, `endPublish` | Rentang `published_at` |
| `sortBy` | Whitelist: `published_at`, `created_at`, `updated_at`, `title`, `source` (default `published_at`) |
| `order` | `asc` atau `desc` (default `desc`), tiebreaker `id DESC` |

Semua nilai dikirim lewat parameterized query, jadi input user tidak pernah masuk ke teks SQL (anti SQL injection).

Contoh:

```
GET /api/articles?page=1&limit=20&sentiment=NEGATIVE&source=kompas.com
```

### Format response

List:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

Detail, create, dan update:

```json
{ "data": {} }
```

Error:

```json
{ "error": "pesan error" }
```

Error validasi:

```json
{ "error": "Validation failed", "details": ["title is required"] }
```

Response `500` selalu `{ "error": "Internal server error" }`. Detail error hanya ditulis ke log server.

### Validasi

`validateArticle` dijalankan pada `POST` dan `PUT`:

- `title`, `content`, `source`, `sentiment`, dan `published_at` wajib diisi.
- String di-trim. `source` dan `sentiment` dinormalisasi ke lowercase.
- `sentiment` hanya boleh `positive`, `neutral`, atau `negative`.
- `published_at` harus tanggal yang valid.
- `url` dan `author` opsional (disimpan sebagai `null`).
- TODO: format `url` belum divalidasi.

`parseId` memvalidasi `:id` di URL: harus integer positif dan maksimal 2^31 - 1. Kalau tidak valid, API mengembalikan `400` dengan `"Invalid article id"`.

### Status code

| Kode | Kapan |
| --- | --- |
| 200 | OK |
| 201 | Artikel berhasil dibuat |
| 204 | Artikel berhasil dihapus |
| 400 | Validasi gagal atau id tidak valid |
| 401 | Token tidak ada atau tidak valid |
| 403 | Bukan admin |
| 404 | Tidak ditemukan, atau milik organisasi lain |
| 500 | Internal server error |

## Soft delete

`DELETE` mengisi `deleted_at = NOW()`, bukan menghapus baris, dan semua query memfilter `deleted_at IS NULL`.

Alasannya:

- Data yang terhapus bisa dipulihkan.
- Ada jejak audit.
- Data historis tetap bisa dianalisis untuk media monitoring.

## Dokumentasi API dan automated test

Postman collection [`postman/Articles_API.postman_collection.json`](postman/Articles_API.postman_collection.json) mendokumentasikan semua endpoint sekaligus berisi automated test: 15 request dan 34 assertion.

Jalankan dengan Postman (import file collection, lalu buka Collection Runner), atau dengan newman:

```bash
npx newman run postman/Articles_API.postman_collection.json
```

- Variable `baseUrl` default-nya `http://localhost:3000`. Untuk server di alamat lain, tambahkan `--env-var baseUrl=http://host:port`.
- Test memakai data dari `seed.sql` (misalnya artikel id 3 milik organisasi 2), jadi jalankan di database yang sudah di-seed.
- Collection bisa dijalankan berulang kali: artikel yang dibuat di tengah run dihapus lagi di akhir run.

Setiap request mengatur header `Authorization` sendiri dengan token per akun (`tokenAdmin1`, `tokenAdmin2`), supaya saat runner berjalan berurutan token satu akun tidak menimpa token akun lain.

Sudah dites:

- Login
- List articles
- List dari organisasi lain (`data` kosong, `totalItems` 0)
- Detail artikel
- Detail dari organisasi lain (404)
- Detail tidak ditemukan (404)
- Create article (201)
- Create dengan sentiment tidak valid (400)
- Create dengan sentiment null (400)
- Update article
- Update tanpa title (400 dengan `details`)
- Delete (204)
- Delete tidak ditemukan (404)

Belum dites (TODO):

- 401 tanpa token
- 403 saat role `user` memanggil `POST`
- Pencegahan artikel duplikat

## Catatan performa (Soal 2)

Query yang dianalisis, pada 5 juta artikel:

```
GET /api/articles?sentiment=NEGATIVE&source=kompas.com&page=1&limit=50
```

Investigasi dengan `EXPLAIN ANALYZE`:

- Tanpa index, plan-nya Seq Scan, lalu Sort, lalu Limit.
- Dengan composite partial index di atas (dicoba dengan `SET enable_seqscan = off` pada data kecil), plan-nya menjadi Index Scan dan langkah Sort hilang, karena index sudah mengembalikan baris dalam urutan `published_at DESC, id DESC`.
- `sentiment` dan `source` difilter dengan `=` pada data yang sudah dinormalisasi lowercase (bukan `ILIKE`), supaya index B-tree bisa dipakai.

Rencana lanjutan:

- Biaya `COUNT(*)` untuk `totalItems` pada hasil yang besar
- Keyset pagination untuk halaman yang jauh
- `pg_trgm` atau full-text search (GIN) untuk `search`
- Cache

## Roadmap

- Rewrite ke TypeScript
- Validasi format `url`
- Pencegahan duplikat: unique constraint misalnya `(organization_id, url)`, mengembalikan `409`
- Tolak login kalau organisasi tidak active
