// server.js
const express = require('express');
const db = require('./database.js');
const app = express();
const PORT = 3000;
// ... (multer, fs, etc.)

app.use(express.json());
app.use(express.static('public/admin'));
app.use(express.static('public/user'));
app.use(express.static('public'));

let sessions = {};

// --- Helper function to check user permissions ---
async function userHasPermission(userId, action) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT 1 FROM user_roles ur JOIN role_permissions rp ON ur.roleId = rp.roleId JOIN permissions p ON rp.permissionId = p.id WHERE ur.userId = ? AND p.action = ? LIMIT 1`;
        db.get(sql, [userId, action], (err, row) => {
            if (err) reject(err);
            resolve(!!row);
        });
    });
}

// --- USER-FACING APIs ---
app.get('/api/submission/:id', (req, res) => {
    const userId = sessions[req.headers['authorization']]?.id;
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });
    
    // UPDATED: Join with the programs table to get the program name
    const sql = `
        SELECT s.*, u.firstName, u.lastName, p.name as programName 
        FROM submissions s 
        JOIN users u ON s.userId = u.id 
        JOIN programs p ON s.programId = p.id
        WHERE s.id = ?`;

    db.get(sql, [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) {
            userHasPermission(userId, 'view_all_submissions').then(canViewAll => {
                if (row.userId === userId || canViewAll) {
                    row.answers = JSON.parse(row.answers);
                    if (row.rejectionReasons) row.rejectionReasons = JSON.parse(row.rejectionReasons);
                    row.userName = `${row.firstName} ${row.lastName}`;
                    res.json(row);
                } else {
                    res.status(403).json({ message: 'Forbidden' });
                }
            });
        } else {
            res.status(404).json({ message: 'Submission not found' });
        }
    });
});


// (All other endpoints are included for a complete, stable file)
app.post('/api/login', (req, res) => { const { email } = req.body; db.get("SELECT * FROM users WHERE email = ? AND status != 'deactivated'", [email], (err, user) => { if (err) return res.status(500).json({ error: err.message }); if (user) { const token = `magic-token-${user.id}-${Date.now()}`; sessions[token] = { id: user.id }; res.json({ message: 'Magic link sent!', token }); } else { res.status(404).json({ message: 'User not found' }); } }); });
app.get('/api/verify/:token', (req, res) => { const session = sessions[req.params.token]; if (!session) return res.status(401).json({ message: 'Invalid or expired token.' }); db.get("SELECT * FROM users WHERE id = ?", [session.id], async (err, user) => { if (err || !user) return res.status(500).json({ error: err?.message || "User not found" }); user.permissions = await userHasPermission(user.id, 'view_all_submissions') ? ['view_all_submissions'] : []; sessions[req.params.token] = user; res.json({ message: 'Login successful!', user, sessionToken: req.params.token }); }); });
app.get('/api/my-submissions', async (req, res) => { const user = sessions[req.headers['authorization']]; if (!user || !user.id) return res.status(401).json({ message: 'Not authenticated' }); try { const canViewAll = user.permissions && user.permissions.includes('view_all_submissions'); let sql, params; if (canViewAll) { sql = `SELECT s.*, u.email as userEmail, u.firstName, u.lastName FROM submissions s JOIN users u ON s.userId = u.id`; params = []; } else { sql = `SELECT *, NULL as userEmail, NULL as firstName, NULL as lastName FROM submissions WHERE userId = ?`; params = [user.id]; } db.all(sql, params, (err, rows) => { if (err) return res.status(500).json({ error: err.message }); const submissionsByProgram = {}; rows.forEach(row => { if (!submissionsByProgram[row.programId]) submissionsByProgram[row.programId] = []; submissionsByProgram[row.programId].push({ id: row.id, answers: JSON.parse(row.answers), submissionDate: row.submissionDate, status: row.status, userEmail: row.userEmail, userName: `${row.firstName} ${row.lastName}` }); }); res.json(submissionsByProgram); }); } catch (err) { res.status(500).json({ error: err.message }); } });
app.get('/api/public/registration-fields', (req, res) => { res.json([ { fieldKey: 'first_name', fieldLabel: 'First Name', isDefault: true }, { fieldKey: 'last_name', fieldLabel: 'Last Name', isDefault: true }, { fieldKey: 'email', fieldLabel: 'Email', isDefault: true }, ]); });
app.post('/api/register', (req, res) => { const { email, first_name, last_name } = req.body.defaultData; db.run(`INSERT INTO users (firstName, lastName, email, status) VALUES (?, ?, ?, ?)`, [first_name, last_name, email, 'registered'], function(err) { if (err) { if (err.message.includes("UNIQUE constraint failed")) return res.status(409).json({ message: 'User with this email already exists.' }); return res.status(500).json({ error: err.message }); } res.status(201).json({ message: 'Registration successful! Please log in.' }); }); });
app.get('/api/my-programs', (req, res) => { const userId = sessions[req.headers['authorization']]?.id; if (!userId) return res.status(401).json({ message: 'Not authenticated' }); const sql = `SELECT p.*, ar.accessLevel FROM programs p JOIN access_rights ar ON p.id = ar.programId WHERE ar.userId = ?`; db.all(sql, [userId], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }); });
app.post('/api/request-access', (req, res) => { const userId = sessions[req.headers['authorization']]?.id; if (!userId) return res.status(401).json({ message: 'Not authenticated' }); const { programId } = req.body; db.run(`INSERT INTO access_requests (userId, programId, status) VALUES (?, ?, ?)`, [userId, programId, 'pending'], function(err) { if (err) return res.status(500).json({ error: err.message }); res.status(201).json({ message: 'Request submitted.' }); }); });
app.post('/api/programs/:id/submit', (req, res) => { const userId = sessions[req.headers['authorization']]?.id; if (!userId) return res.status(401).json({ message: 'Not authenticated' }); const { id } = req.params; const answers = JSON.stringify(req.body); db.run(`INSERT INTO submissions (programId, userId, submissionDate, answers, status) VALUES (?, ?, ?, ?, ?)`, [id, userId, new Date().toISOString(), 'Submitted'], function(err) { if (err) return res.status(500).json({ error: err.message }); res.status(201).json({ message: 'Submission successful!' }); }); });
app.get('/api/roles', (req, res) => { db.all("SELECT * FROM roles", [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }); });
app.post('/api/roles', (req, res) => { const { name } = req.body; db.run(`INSERT INTO roles (name) VALUES (?)`, [name], function(err) { if (err) return res.status(500).json({ error: err.message }); res.status(201).json({ id: this.lastID, name }); }); });
app.get('/api/permissions', (req, res) => { db.all("SELECT * FROM permissions", [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }); });
app.get('/api/roles/:id/permissions', (req, res) => { const sql = "SELECT permissionId FROM role_permissions WHERE roleId = ?"; db.all(sql, [req.params.id], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows.map(r => r.permissionId)); }); });
app.put('/api/roles/:id/permissions', (req, res) => { const roleId = req.params.id; const { permissionIds } = req.body; db.serialize(() => { db.run("DELETE FROM role_permissions WHERE roleId = ?", [roleId]); const stmt = db.prepare("INSERT INTO role_permissions (roleId, permissionId) VALUES (?, ?)"); for (const permissionId of permissionIds) { stmt.run(roleId, permissionId); } stmt.finalize((err) => { if (err) return res.status(500).json({ error: err.message }); res.status(200).json({ message: 'Permissions updated successfully' }); }); }); });
app.get('/api/users/:id/roles', (req, res) => { db.all("SELECT roleId FROM user_roles WHERE userId = ?", [req.params.id], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows.map(r => r.roleId)); }); });
app.put('/api/users/:id/roles', (req, res) => { const userId = req.params.id; const { roleIds } = req.body; db.serialize(() => { db.run("DELETE FROM user_roles WHERE userId = ?", [userId]); const stmt = db.prepare("INSERT INTO user_roles (userId, roleId) VALUES (?, ?)"); for (const roleId of roleIds) { stmt.run(userId, roleId); } stmt.finalize((err) => { if (err) return res.status(500).json({ error: err.message }); res.status(200).json({ message: 'User roles updated successfully' }); }); }); });
app.get('/api/users', (req, res) => { db.all("SELECT * FROM users", [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }); });
app.post('/api/users/invite', (req, res) => { const { firstName, lastName, email } = req.body; db.run(`INSERT INTO users (firstName, lastName, email, status) VALUES (?, ?, ?, ?)`, [firstName, lastName, email, 'pending'], function(err) { if (err) return res.status(500).json({ error: err.message }); res.status(201).json({ id: this.lastID, ...req.body }); }); });
app.put('/api/users/:id/deactivate', (req, res) => { db.run(`UPDATE users SET status = 'deactivated' WHERE id = ?`, [req.params.id], function(err) { if (err) return res.status(500).json({ error: err.message }); res.json({ message: 'User deactivated' }); }); });
app.get('/api/programs', (req, res) => { db.all("SELECT * FROM programs", [], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); res.json(rows); }); });
app.post('/api/programs', (req, res) => { const { name, description, logoUrl, startDate, startTime } = req.body; const sql = `INSERT INTO programs (name, description, logoUrl, startDate, startTime, endDate) VALUES (?, ?, ?, ?, ?, ?)`; db.run(sql, [name, description, logoUrl, startDate, startTime, '2099-12-31'], function(err) { if (err) return res.status(500).json({ error: err.message }); res.status(201).json({ id: this.lastID, ...req.body }); }); });
app.get('/api/programs/:id/form', (req, res) => { db.all("SELECT * FROM form_fields WHERE programId = ?", [req.params.id], (err, rows) => { if (err) return res.status(500).json({ error: err.message }); const fields = rows.map(field => { if (field.options) field.options = JSON.parse(field.options); if (field.condition) field.condition = JSON.parse(field.condition); return field; }); res.json(fields); }); });
app.post('/api/programs/:id/fields', (req, res) => { const { label, key, type, options, condition } = req.body; const sql = `INSERT INTO form_fields (programId, label, key, type, options, condition) VALUES (?, ?, ?, ?, ?, ?)`; const params = [ req.params.id, label, key, type, options ? JSON.stringify(options) : null, condition ? JSON.stringify(condition) : null ]; db.run(sql, params, function(err) { if (err) return res.status(500).json({ error: err.message }); res.status(201).json({ id: this.lastID, ...req.body }); }); });

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});