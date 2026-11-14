const express = require('express');
const db = require('./db');
const app = express();
const port = 3000;
app.use(express.json());
const authRoutes = require('./src/routes/authRoutes');
const { authenticate, authorize } = require('./src/middleware/auth');

app.use('/api/auth', authRoutes);
app.use('/api/articles', authenticate);

// Order with relevant field
const ALLOWED_SORT_COLUMNS = {
    published_at: 'published_at',
    created_at: 'created_at',
    updated_at: 'updated_at',
    title: 'title',
    source: 'source',
};

const SENTIMENTS = ['positive', 'neutral', 'negative'];
const REQUIRED_FIELDS = ['title', 'content', 'source', 'sentiment', 'published_at'];
const PG_INT_MAX = 2 ** 31 - 1;

const clean = (value) => (typeof value === 'string' ? value.trim() : value);

function validateArticle(body = {}) {
    const article = {
        title: clean(body.title),
        content: clean(body.content),
        url: clean(body.url) || null,
        source: clean(body.source)?.toLowerCase(),
        author: clean(body.author) || null,
        sentiment: clean(body.sentiment)?.toLowerCase(),
        published_at: clean(body.published_at),
    }

    const errors = [];
    for (const field of REQUIRED_FIELDS) {
        if (!article[field]) errors.push(`${field} is required`);
    }

    if (article.sentiment && !SENTIMENTS.includes(article.sentiment)) {
        errors.push('sentiment must be positive, neutral, or negative')
    }
    if (article.published_at && Number.isNaN(Date.parse(article.published_at))) {
        errors.push('published_at must be a valid date')
    }

    return { article, errors };
}

function parseId(value) {
    const id = Number(value);
    return (Number.isInteger(id) && id > 0 && id <= PG_INT_MAX) ? id : null
}

app.get('/', (_req, res) => {
    res.send('Hello World!');
});

// GET /api/articles
// Get all articles with pagination, search, filter, and sorting
app.get('/api/articles', async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const offset = (page - 1) * limit;

        const search = req.query.search;

        const sortColumn = ALLOWED_SORT_COLUMNS[req.query.sortBy] || 'published_at';
        const sortOrder = req.query.order === 'asc' ? 'ASC' : 'DESC';

        const source = req.query.source;
        const sentiment = req.query.sentiment;

        const startDate = req.query.startPublish;
        const endDate = req.query.endPublish;

        const conditions = ['deleted_at IS NULL', 'organization_id = $1'];
        const values = [req.user.organization_id];

        if (search) {
            values.push(`%${search}%`);
            conditions.push(`(title ILIKE $${values.length} OR content ILIKE $${values.length})`);
        }

        if (source) {
            values.push(source.toLowerCase());
            conditions.push(`source = $${values.length}`);
        }

        if (sentiment) {
            values.push(sentiment.toLowerCase());
            conditions.push(`sentiment = $${values.length}`);
        }

        if (startDate) {
            values.push(startDate);
            conditions.push(`published_at >= $${values.length}`);
        }

        if (endDate) {
            values.push(endDate);
            conditions.push(`published_at <= $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Query total count (for pagination metadata) + paginated rows in parallel
        const countQuery = `SELECT COUNT(*)::int AS total FROM articles ${whereClause}`;

        const dataQuery = `
        SELECT id, organization_id, title, content, url, source, author, sentiment, published_at, created_at, updated_at
        FROM articles
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}, id DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
        `;

        const [countResult, dataResult] = await Promise.all([
            db.query(countQuery, values),
            db.query(dataQuery, [...values, limit, offset]),
        ]);
        const totalItems = countResult.rows[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        res.json({
            data: dataResult.rows,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        });
    } catch (err) {
        console.error('Error fetching articles:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/articles/{id}
app.get('/api/articles/:id', async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid article id' });

        const result = await db.query(
            `SELECT id, organization_id, title, content, url, source, author, sentiment, published_at, created_at, updated_at 
            FROM articles 
            WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`, [id, req.user.organization_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Article not found' });
        }

        res.json({ data: result.rows[0] });
    } catch (err) {
        console.error('Error fetching article by ID:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/articles
// New articles with validation
app.post('/api/articles', authorize('admin'), async (req, res) => {
    try {
        const organization_id = req.user.organization_id;

        const { article, errors } = validateArticle(req.body);
        if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', details: errors});

        const result = await db.query(
            `INSERT INTO articles (organization_id, title, content, url, source, author, sentiment, published_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, organization_id, title, content, url, source, author, sentiment, published_at, created_at, updated_at`,
            [organization_id, article.title, article.content, article.url, article.source, article.author, article.sentiment, article.published_at]
        );

        res.status(201).json({ data: result.rows[0] });
    } catch (err) {
        console.error('Error creating article:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT/PATCH /api/articles/{id}
app.put('/api/articles/:id', authorize('admin'), async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid article id' });

        const { article, errors } = validateArticle(req.body);
        if ( errors.length > 0) return res.status(400).json({ error: 'Validation failed', details: errors}); 

        const result = await db.query(
            `UPDATE articles
            SET title = $1, content = $2, url = $3, source = $4, author = $5, sentiment = $6, published_at = $7, updated_at = NOW()
            WHERE id = $8 AND organization_id = $9 AND deleted_at IS NULL
            RETURNING id, organization_id, title, content, url, source, author, sentiment, published_at, created_at, updated_at`,
            [article.title, article.content, article.url, article.source, article.author, article.sentiment, article.published_at, id, req.user.organization_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Article not found' });
        }

        res.json({ data: result.rows[0] });
    } catch (err) {
        console.error('Error updating article:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/articles/{id}
app.delete('/api/articles/:id', authorize('admin'), async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Invalid article id' });

        const result = await db.query(
            `UPDATE articles 
            SET updated_at = NOW(), deleted_at = NOW()
            WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
            RETURNING id`,
            [id, req.user.organization_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Article not found' });
        }

        res.status(204).send();
    } catch (err) {
        console.error('Error deleting article:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});