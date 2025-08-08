// database.js
const sqlite3 = require('sqlite3').verbose();
const DB_SOURCE = "tradeportal.db";

const db = new sqlite3.Database(DB_SOURCE, (err) => {
    if (err) { console.error(err.message); throw err; }
    else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            console.log("Initializing database schema...");
            // --- Core Tables ---
            db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, firstName TEXT, lastName TEXT, email TEXT UNIQUE, status TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS programs (id INTEGER PRIMARY KEY, name TEXT, description TEXT, logoUrl TEXT, startDate TEXT, startTime TEXT, endDate TEXT, leaderboardUrl TEXT, branding TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS form_fields (id INTEGER PRIMARY KEY, programId INTEGER, label TEXT, key TEXT, type TEXT, options TEXT, condition TEXT, placeholderText TEXT, helpText TEXT, FOREIGN KEY(programId) REFERENCES programs(id))`);
            
            // UPDATED submissions table
            db.run(`CREATE TABLE IF NOT EXISTS submissions (
                id INTEGER PRIMARY KEY,
                programId INTEGER,
                userId INTEGER,
                submissionDate TEXT,
                answers TEXT,
                status TEXT,
                rejectionReasons TEXT,
                FOREIGN KEY(programId) REFERENCES programs(id),
                FOREIGN KEY(userId) REFERENCES users(id)
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS access_rights (userId INTEGER, programId INTEGER, accessLevel TEXT, PRIMARY KEY(userId, programId), FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(programId) REFERENCES programs(id))`);
            db.run(`CREATE TABLE IF NOT EXISTS access_requests (id INTEGER PRIMARY KEY, userId INTEGER, programId INTEGER, status TEXT, FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(programId) REFERENCES programs(id))`);
            db.run(`CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY, name TEXT UNIQUE)`);
            db.run(`CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY, action TEXT UNIQUE, description TEXT)`);
            db.run(`CREATE TABLE IF NOT EXISTS user_roles (userId INTEGER, roleId INTEGER, PRIMARY KEY(userId, roleId), FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(roleId) REFERENCES roles(id))`);
            db.run(`CREATE TABLE IF NOT EXISTS role_permissions (roleId INTEGER, permissionId INTEGER, PRIMARY KEY(roleId, permissionId), FOREIGN KEY(roleId) REFERENCES roles(id), FOREIGN KEY(permissionId) REFERENCES permissions(id))`);

            const permissions = [
                { action: 'manage_programs', description: 'Can create, edit, and manage programs.' },
                { action: 'manage_users', description: 'Can invite, deactivate, and manage all users.' },
                { action: 'manage_roles', description: 'Can create roles and assign permissions.' },
                { action: 'view_own_submissions', description: 'Can view their own submissions.' },
                { action: 'view_all_submissions', description: 'Can view all submissions for programs.' }
            ];
            const insertPermission = db.prepare("INSERT OR IGNORE INTO permissions (action, description) VALUES (?, ?)");
            permissions.forEach(p => insertPermission.run(p.action, p.description));
            insertPermission.finalize(err => {
                if (!err) console.log("Permissions seeded successfully.");
            });
        });
    }
});

module.exports = db;