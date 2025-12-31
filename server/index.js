const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const serverless = require('serverless-http');
const sqlite3 = require('sqlite3').verbose();

// Use In-Memory DB for Netlify Functions (Since FS is read-only/ephemeral)
const db = new sqlite3.Database(':memory:');

// Initialize DB Schema (Since it resets every time)
db.serialize(() => {
    // Enable Foreign Keys
    db.run("PRAGMA foreign_keys = ON");

    // 1. Bases
    db.run(`CREATE TABLE IF NOT EXISTS bases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        location TEXT
    )`);

    // 2. Users
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT, -- 'admin', 'logistics', 'commander'
        base_id INTEGER,
        FOREIGN KEY(base_id) REFERENCES bases(id)
    )`);

    // 3. Assets (Catalog)
    db.run(`CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT, -- 'vehicle', 'weapon', 'ammo'
        description TEXT
    )`);

    // 4. Inventory
    db.run(`CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        base_id INTEGER,
        asset_id INTEGER,
        quantity INTEGER DEFAULT 0,
        UNIQUE(base_id, asset_id)
    )`);

    // 5. Transactions (History)
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT, -- 'PURCHASE', 'TRANSFER', 'ASSIGN', 'EXPEND'
        asset_id INTEGER,
        source_base_id INTEGER,
        dest_base_id INTEGER,
        quantity INTEGER,
        user_id INTEGER,
        date DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // SEED DATA
    db.get("SELECT count(*) as count FROM bases", [], (err, row) => {
        if (row && row.count === 0) {
            console.log("Seeding In-Memory Database...");
            db.run("INSERT INTO bases (name, location) VALUES ('Alpha Base', 'Sector 1')");
            db.run("INSERT INTO bases (name, location) VALUES ('Bravo Base', 'Sector 2')");
            db.run("INSERT INTO bases (name, location) VALUES ('Command HQ', 'Capital')");

            db.run("INSERT INTO users (username, password, role, base_id) VALUES ('admin', 'admin123', 'admin', 3)");
            db.run("INSERT INTO users (username, password, role, base_id) VALUES ('logistics', 'pass123', 'logistics', 2)");
            db.run("INSERT INTO users (username, password, role, base_id) VALUES ('commander', 'pass123', 'commander', 1)");

            db.run("INSERT INTO assets (name, type, description) VALUES ('M4 Carbine', 'weapon', 'Standard issue rifle')");
            db.run("INSERT INTO assets (name, type, description) VALUES ('Humvee', 'vehicle', 'Tactical transport')");
            db.run("INSERT INTO assets (name, type, description) VALUES ('5.56mm Ammo', 'ammo', 'Crate of 1000 rounds')");

            // Initial Stock
            db.run("INSERT INTO inventory (base_id, asset_id, quantity) VALUES (1, 1, 50)"); // Alpha has 50 Rifles
            db.run("INSERT INTO inventory (base_id, asset_id, quantity) VALUES (2, 2, 5)");  // Bravo has 5 Humvees
        }
    });
});

const app = express();
const router = express.Router();

app.use(cors());
app.use(bodyParser.json());

// Middleware for logging
app.use((req, res, next) => {
    // console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Mock Authentication/RBAC Middleware
const checkRole = (allowedRoles) => (req, res, next) => {
    const userRole = req.headers['x-role'];
    if (!userRole || (allowedRoles.length > 0 && !allowedRoles.includes(userRole))) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
};

// --- APIs ---
// Use router for /api path prefix handling in Netlify Functions

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json({
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                base_id: user.base_id
            }
        });
    });
});

// Get Bases
router.get('/bases', (req, res) => {
    db.all("SELECT * FROM bases", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get Assets
router.get('/assets', (req, res) => {
    db.all("SELECT * FROM assets", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Dashboard Stats
router.get('/dashboard', (req, res) => {
    const baseId = req.query.base_id;
    const type = req.query.type;

    let inventoryQuery = `
        SELECT a.name, a.type, SUM(i.quantity) as current_balance
        FROM inventory i
        JOIN assets a ON i.asset_id = a.id
        WHERE 1=1
    `;
    const inventoryParams = [];
    if (baseId) {
        inventoryQuery += " AND i.base_id = ?";
        inventoryParams.push(baseId);
    }
    if (type) {
        inventoryQuery += " AND a.type = ?";
        inventoryParams.push(type);
    }
    inventoryQuery += " GROUP BY a.id";

    db.all(inventoryQuery, inventoryParams, (err, inventory) => {
        if (err) return res.status(500).json({ error: err.message });

        let transQuery = `
            SELECT t.type, SUM(t.quantity) as total 
            FROM transactions t
            LEFT JOIN assets a ON t.asset_id = a.id
            WHERE 1=1
        `;
        const transParams = [];

        if (baseId) {
            transQuery += ` AND (t.dest_base_id = ? OR t.source_base_id = ?)`;
            transParams.push(baseId, baseId);
        }
        if (type) {
            transQuery += " AND a.type = ?";
            transParams.push(type);
        }

        transQuery += " GROUP BY t.type";

        db.all(transQuery, transParams, (err, transactions) => {
            if (err) return res.status(500).json({ error: err.message });

            const movements = { purchased: 0, transferred_in: 0, transferred_out: 0, assigned: 0, expended: 0 };

            // (Simplification for Netlify/Memory stats)
            transactions.forEach(t => {
                if (t.type === 'PURCHASE') movements.purchased += t.total;
            });

            if (baseId) {
                db.all(`
                    SELECT 
                        CASE 
                            WHEN type = 'PURCHASE' THEN 'PURCHASE'
                            WHEN type = 'TRANSFER' AND dest_base_id = ? THEN 'TRANSFER_IN'
                            WHEN type = 'TRANSFER' AND source_base_id = ? THEN 'TRANSFER_OUT'
                            WHEN type = 'ASSIGN' THEN 'ASSIGN'
                            WHEN type = 'EXPEND' THEN 'EXPEND'
                        END as movement_type,
                        SUM(quantity) as total
                    FROM transactions t
                    JOIN assets a ON t.asset_id = a.id
                    WHERE (dest_base_id = ? OR source_base_id = ?)
                    ${type ? "AND a.type = ?" : ""}
                    GROUP BY movement_type
                 `, [baseId, baseId, baseId, baseId, ...(type ? [type] : [])], (err, preciseRows) => {
                    if (err) return res.status(500).json({ error: err.message });

                    const stats = {
                        opening_balance: 0,
                        closing_balance: inventorySize(inventory),
                        movements: { purchased: 0, transfer_in: 0, transfer_out: 0, assigned: 0, expended: 0 }
                    };

                    preciseRows.forEach(r => {
                        if (r.movement_type === 'PURCHASE') stats.movements.purchased = r.total;
                        if (r.movement_type === 'TRANSFER_IN') stats.movements.transfer_in = r.total;
                        if (r.movement_type === 'TRANSFER_OUT') stats.movements.transfer_out = r.total;
                        if (r.movement_type === 'ASSIGN') stats.movements.assigned = r.total;
                        if (r.movement_type === 'EXPEND') stats.movements.expended = r.total;
                    });

                    const net = stats.movements.purchased + stats.movements.transfer_in - stats.movements.transfer_out;
                    stats.opening_balance = stats.closing_balance - net;
                    res.json(stats);
                });
            } else {
                res.json({ inventory, raw_transactions: transactions });
            }
        });
    });
});

function inventorySize(rows) {
    return rows.reduce((acc, r) => acc + r.current_balance, 0);
}

// Purchase
router.post('/purchases', checkRole(['admin', 'logistics']), (req, res) => {
    const { asset_id, base_id, quantity, user_id } = req.body;
    db.serialize(() => {
        db.run(`INSERT INTO transactions (type, asset_id, dest_base_id, quantity, user_id) VALUES ('PURCHASE', ?, ?, ?, ?)`,
            [asset_id, base_id, quantity, user_id]);

        db.run(`INSERT INTO inventory (base_id, asset_id, quantity) VALUES (?, ?, ?) 
                ON CONFLICT(base_id, asset_id) DO UPDATE SET quantity = quantity + ?`,
            [base_id, asset_id, quantity, quantity], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Purchase recorded successfully' });
            });
    });
});

// Transfer
router.post('/transfers', checkRole(['admin', 'logistics']), (req, res) => {
    const { asset_id, source_base_id, dest_base_id, quantity, user_id } = req.body;
    db.serialize(() => {
        db.run("UPDATE inventory SET quantity = quantity - ? WHERE base_id = ? AND asset_id = ?", [quantity, source_base_id, asset_id]);
        db.run(`INSERT INTO inventory (base_id, asset_id, quantity) VALUES (?, ?, ?) 
                ON CONFLICT(base_id, asset_id) DO UPDATE SET quantity = quantity + ?`,
            [dest_base_id, asset_id, quantity, quantity]);
        db.run(`INSERT INTO transactions (type, asset_id, source_base_id, dest_base_id, quantity, user_id) 
                VALUES ('TRANSFER', ?, ?, ?, ?, ?)`,
            [asset_id, source_base_id, dest_base_id, quantity, user_id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Transfer successful' });
            });
    });
});

// Assignments/Expenditure
router.post('/assignments', checkRole(['admin', 'commander']), (req, res) => {
    const { asset_id, base_id, quantity, type, user_id } = req.body;
    db.serialize(() => {
        if (type === 'EXPEND') {
            db.run("UPDATE inventory SET quantity = quantity - ? WHERE base_id = ? AND asset_id = ?", [quantity, base_id, asset_id]);
        }
        db.run(`INSERT INTO transactions (type, asset_id, source_base_id, quantity, user_id) 
                VALUES (?, ?, ?, ?, ?)`,
            [type, asset_id, base_id, quantity, user_id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: `${type} recorded successfully` });
            });
    });
});

// History
router.get('/history', (req, res) => {
    const { base_id } = req.query;
    let query = `
        SELECT t.*, a.name as asset_name, u.username as user_name,
               b1.name as source_base, b2.name as dest_base
        FROM transactions t
        JOIN assets a ON t.asset_id = a.id
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN bases b1 ON t.source_base_id = b1.id
        LEFT JOIN bases b2 ON t.dest_base_id = b2.id
        WHERE 1=1
    `;
    const params = [];
    if (base_id) {
        query += " AND (t.source_base_id = ? OR t.dest_base_id = ?)";
        params.push(base_id, base_id);
    }
    query += " ORDER BY t.date DESC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Mount router at /api
app.use('/api', router);

// Export for Serverless
module.exports.handler = serverless(app);

