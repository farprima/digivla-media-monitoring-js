# AI Usage

---

**AI TOOL USED:** Claude

**PURPOSE:** Mengingat kembali syntax `CREATE INDEX` untuk composite index di PostgreSQL.

**EXAMPLE OF QUESTION:**

> Saya mau bikin index untuk field organization_id, source, sentiment, published_at agar get requestnya bisa lebih cepat jika terdapat 5 juta record articles, tapi saya lupa syntaxnya, perlu ngetiknya seperti apa ya

**WHAT I USED FROM THE RESULT:** Syntax `CREATE INDEX ... ON articles (...)` untuk index dengan beberapa kolom.

**WHAT I IMPLEMENTED MYSELF:**

- Menentukan kolom yang perlu di-index (`organization_id`, `source`, `sentiment`, `published_at`) berdasarkan filter dan sorting `GET /api/articles` pada skenario 5 juta artikel.
- Menerapkan index tersebut di [`schema.sql`](schema.sql).