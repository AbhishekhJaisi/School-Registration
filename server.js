const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');

const app = express();
const port = 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files

// --- Database Setup ---
const db = new sqlite3.Database('./database/database.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the College Connect database.');
});

// Create tables if they don't exist
db.serialize(() => {
    // Users table with roles (student, admin)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student'
    )`);

    // Notices table
    db.run(`CREATE TABLE IF NOT EXISTS notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        createdAt TEXT NOT NULL
    )`);

    // Documents table
    db.run(`CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        username TEXT NOT NULL,
        filePath TEXT NOT NULL,
        originalName TEXT NOT NULL,
        uploadedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users (id)
    )`);
});

// --- File Upload Setup (Multer) ---
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function(req, file, cb) {
        // Use user ID in filename to ensure uniqueness
        const userId = req.body.userId || 'unknown';
        cb(null, `user-${userId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });


// --- API ROUTES ---

// 1. User Authentication
app.post('/api/register', async (req, res) => {
    const { username, password, role = 'student' } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`;
    db.run(sql, [username, hashedPassword, role], function(err) {
        if (err) {
            return res.status(409).json({ error: 'Username already exists.' });
        }
        res.status(201).json({ message: 'User registered successfully!', userId: this.lastID });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = `SELECT * FROM users WHERE username = ?`;
    db.get(sql, [username], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            res.json({ message: 'Login successful!', userId: user.id, username: user.username, role: user.role });
        } else {
            res.status(401).json({ error: 'Invalid credentials.' });
        }
    });
});

// 2. Notices (Admin can post, all can view)
app.post('/api/notices', (req, res) => {
    const { title, content, author } = req.body;
    const createdAt = new Date().toISOString();
    const sql = `INSERT INTO notices (title, content, author, createdAt) VALUES (?, ?, ?, ?)`;
    db.run(sql, [title, content, author, createdAt], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Notice posted successfully!', noticeId: this.lastID });
    });
});

app.get('/api/notices', (req, res) => {
    db.all(`SELECT * FROM notices ORDER BY createdAt DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 3. Document Upload (Students upload, Admin views all)
app.post('/api/upload', upload.single('document'), (req, res) => {
    const { userId, username } = req.body;
    if (!req.file) {
        return res.status(400).json({ error: 'Please select a file to upload.' });
    }
    const { path: filePath, originalname: originalName } = req.file;
    const uploadedAt = new Date().toISOString();

    const sql = `INSERT INTO documents (userId, username, filePath, originalName, uploadedAt) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [userId, username, filePath, originalName, uploadedAt], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'File uploaded successfully!', filePath });
    });
});

app.get('/api/documents', (req, res) => {
    // Admin gets all documents, students get only their own
    const { userId, role } = req.query;
    let sql = `SELECT * FROM documents`;
    if (role === 'student') {
        sql += ` WHERE userId = ?`;
    }
    sql += ` ORDER BY uploadedAt DESC`;

    db.all(sql, role === 'student' ? [userId] : [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Start Server
app.listen(port, () => {
    console.log(`College Connect server running at http://localhost:${port}`);
});

