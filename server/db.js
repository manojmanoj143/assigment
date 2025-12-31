const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'military_assets.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

const initDb = () => {
    db.serialize(() => {
        // Bases
        db.run(`CREATE TABLE IF NOT EXISTS bases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT
        )`);

        // Users
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL, -- 'admin', 'commander', 'logistics'
            base_id INTEGER,
            FOREIGN KEY (base_id) REFERENCES bases (id)
        )`);

        // Assets (Definitions)
        db.run(`CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL, -- 'Weapon', 'Vehicle', 'Ammo'
            description TEXT
        )`);

        // Inventory (Current stock at a base)
        db.run(`CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            base_id INTEGER NOT NULL,
            asset_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 0,
            FOREIGN KEY (base_id) REFERENCES bases (id),
            FOREIGN KEY (asset_id) REFERENCES assets (id),
            UNIQUE(base_id, asset_id)
        )`);

        // Transactions (History)
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL, -- 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ASSIGN', 'EXPEND'
            asset_id INTEGER NOT NULL,
            source_base_id INTEGER, -- For transfers
            dest_base_id INTEGER, -- For purchases/transfers
            quantity INTEGER NOT NULL,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER,
            status TEXT DEFAULT 'COMPLETED',
            FOREIGN KEY (asset_id) REFERENCES assets (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Seed Data
        db.get("SELECT count(*) as count FROM bases", (err, row) => {
            if (row.count === 0) {
                console.log("Seeding data...");
                const bases = [
                    ['Alpha Base', 'Sector 1'],
                    ['Bravo Base', 'Sector 2'],
                    ['Charlie Base', 'Sector 3']
                ];
                const stmt = db.prepare("INSERT INTO bases (name, location) VALUES (?, ?)");
                bases.forEach(b => stmt.run(b));
                stmt.finalize();

                const users = [
                    ['admin', 'admin123', 'admin', null],
                    ['commander_alpha', 'pass123', 'commander', 1],
                    ['logistics_bravo', 'pass123', 'logistics', 2]
                ];
                const userStmt = db.prepare("INSERT INTO users (username, password, role, base_id) VALUES (?, ?, ?, ?)");
                users.forEach(u => userStmt.run(u));
                userStmt.finalize();

                const assets = [
                    ['M4 Carbine', 'Weapon', 'Standard issue assault rifle'],
                    ['Humvee', 'Vehicle', 'High mobility multipurpose wheeled vehicle'],
                    ['5.56mm Ammo', 'Ammo', 'Standard rifle ammunition']
                ];
                const assetStmt = db.prepare("INSERT INTO assets (name, type, description) VALUES (?, ?, ?)");
                assets.forEach(a => assetStmt.run(a));
                assetStmt.finalize();
            }
        });
    });
};

initDb();

module.exports = db;
