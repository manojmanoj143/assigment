const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const serverless = require('serverless-http');
const alasql = require('alasql');

// Initialize AlaSQL Database
// We use a global variable layout since AlaSQL is in-memory
const db = {};

db.init = () => {
    console.log("Initializing AlaSQL Database...");

    // Create Tables
    alasql("CREATE TABLE IF NOT EXISTS bases (id INT AUTOINCREMENT, name STRING, location STRING)");
    alasql("CREATE TABLE IF NOT EXISTS users (id INT AUTOINCREMENT, username STRING, password STRING, role STRING, base_id INT)");
    alasql("CREATE TABLE IF NOT EXISTS assets (id INT AUTOINCREMENT, name STRING, type STRING, description STRING)");
    // Note: UNIQUE constraint handled manually in logic for simple Alasql usage
    alasql("CREATE TABLE IF NOT EXISTS inventory (id INT AUTOINCREMENT, base_id INT, asset_id INT, quantity INT)");
    alasql("CREATE TABLE IF NOT EXISTS transactions (id INT AUTOINCREMENT, type STRING, asset_id INT, source_base_id INT, dest_base_id INT, quantity INT, user_id INT, date DATETIME)");

    // Seed Data
    const baseCount = alasql("SELECT VALUE COUNT(*) FROM bases");
    if (baseCount === 0) {
        console.log("Seeding Data...");
        alasql("INSERT INTO bases (name, location) VALUES ('Alpha Base', 'Sector 1')");
        alasql("INSERT INTO bases (name, location) VALUES ('Bravo Base', 'Sector 2')");
        alasql("INSERT INTO bases (name, location) VALUES ('Command HQ', 'Capital')");

        alasql("INSERT INTO users (username, password, role, base_id) VALUES ('admin', 'admin123', 'admin', 3)");
        alasql("INSERT INTO users (username, password, role, base_id) VALUES ('logistics', 'pass123', 'logistics', 2)");
        alasql("INSERT INTO users (username, password, role, base_id) VALUES ('commander', 'pass123', 'commander', 1)");

        alasql("INSERT INTO assets (name, type, description) VALUES ('M4 Carbine', 'weapon', 'Standard issue rifle')");
        alasql("INSERT INTO assets (name, type, description) VALUES ('Humvee', 'vehicle', 'Tactical transport')");
        alasql("INSERT INTO assets (name, type, description) VALUES ('5.56mm Ammo', 'ammo', 'Crate of 1000 rounds')");

        // Initial Stock
        alasql("INSERT INTO inventory (base_id, asset_id, quantity) VALUES (1, 1, 50)");
        alasql("INSERT INTO inventory (base_id, asset_id, quantity) VALUES (2, 2, 5)");
    }
};

// Run Initialization
db.init();

const app = express();
const router = express.Router();

app.use(cors());
app.use(bodyParser.json());

// Helper for 'get' (single row)
const dbGet = (sql, params) => {
    const res = alasql(sql, params);
    return res.length > 0 ? res[0] : null;
};
// Helper for 'all' (multiple rows)
const dbAll = (sql, params) => {
    // Alasql params are array. If sql uses '?', Alasql expects [val, val]
    return alasql(sql, params);
};
// Helper for 'run'
const dbRun = (sql, params) => {
    return alasql(sql, params);
};

// --- UPSERT Helper (since AlaSQL ON CONFLICT is tricky) ---
const upsertInventory = (baseId, assetId, qtyToAdd) => {
    const existing = dbGet("SELECT * FROM inventory WHERE base_id = ? AND asset_id = ?", [baseId, assetId]);
    if (existing) {
        dbRun("UPDATE inventory SET quantity = quantity + ? WHERE base_id = ? AND asset_id = ?", [qtyToAdd, baseId, assetId]);
    } else {
        dbRun("INSERT INTO inventory (base_id, asset_id, quantity) VALUES (?, ?, ?)", [baseId, assetId, qtyToAdd]);
    }
};

const checkRole = (allowedRoles) => (req, res, next) => {
    const userRole = req.headers['x-role'];
    if (!userRole || (allowedRoles.length > 0 && !allowedRoles.includes(userRole))) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
};

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const user = dbGet("SELECT * FROM users WHERE username = ? AND password = ?", [username, password]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json({ user });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get Bases
router.get('/bases', (req, res) => {
    try {
        const rows = dbAll("SELECT * FROM bases");
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get Assets
router.get('/assets', (req, res) => {
    try {
        const rows = dbAll("SELECT * FROM assets");
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Dashboard Stats
router.get('/dashboard', (req, res) => {
    const baseId = req.query.base_id ? parseInt(req.query.base_id) : null;
    const type = req.query.type;

    try {
        let invSql = `
            SELECT a.name, a.type, SUM(i.quantity) as current_balance
            FROM inventory i
            JOIN assets a ON i.asset_id = a.id
            WHERE 1=1
        `;
        let invParams = [];
        if (baseId) { invSql += " AND i.base_id = ?"; invParams.push(baseId); }
        if (type) { invSql += " AND a.type = ?"; invParams.push(type); }
        invSql += " GROUP BY a.id, a.name, a.type";

        const inventory = dbAll(invSql, invParams);

        // Transactions
        let transSql = `
            SELECT t.type, SUM(t.quantity) as total 
            FROM transactions t
            LEFT JOIN assets a ON t.asset_id = a.id
            WHERE 1=1
        `;
        let transParams = [];
        if (baseId) {
            transSql += ` AND (t.dest_base_id = ? OR t.source_base_id = ?)`;
            transParams.push(baseId, baseId);
        }
        if (type) { transSql += " AND a.type = ?"; transParams.push(type); }
        transSql += " GROUP BY t.type";

        const transactions = dbAll(transSql, transParams);

        if (baseId) {
            // Detailed breakdown for a base
            // Re-fetch raw transactions to manually aggregate (Alasql CASE support is decent but manual is safer)
            let rawTransSql = `
                SELECT t.*
                FROM transactions t
                JOIN assets a ON t.asset_id = a.id
                WHERE (t.dest_base_id = ? OR t.source_base_id = ?)
            `;
            let rawParams = [baseId, baseId];
            if (type) { rawTransSql += " AND a.type = ?"; rawParams.push(type); }

            const rawTrans = dbAll(rawTransSql, rawParams);

            const stats = {
                opening_balance: 0,
                closing_balance: inventory.reduce((acc, r) => acc + (r.current_balance || 0), 0),
                movements: { purchased: 0, transfer_in: 0, transfer_out: 0, assigned: 0, expended: 0 }
            };

            rawTrans.forEach(t => {
                if (t.type === 'PURCHASE') stats.movements.purchased += t.quantity;
                if (t.type === 'TRANSFER') {
                    if (t.dest_base_id === baseId) stats.movements.transfer_in += t.quantity;
                    if (t.source_base_id === baseId) stats.movements.transfer_out += t.quantity;
                }
                if (t.type === 'ASSIGN') stats.movements.assigned += t.quantity;
                if (t.type === 'EXPEND') stats.movements.expended += t.quantity;
            });

            const net = stats.movements.purchased + stats.movements.transfer_in - stats.movements.transfer_out;
            stats.opening_balance = stats.closing_balance - net;
            res.json(stats);

        } else {
            // Global view
            res.json({ inventory, raw_transactions: transactions });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Purchase
router.post('/purchases', checkRole(['admin', 'logistics']), (req, res) => {
    const { asset_id, base_id, quantity, user_id } = req.body;
    try {
        dbRun("INSERT INTO transactions (type, asset_id, dest_base_id, quantity, user_id, date) VALUES ('PURCHASE', ?, ?, ?, ?, NOW())",
            [asset_id, base_id, quantity, user_id]);

        upsertInventory(base_id, asset_id, quantity);
        res.json({ message: 'Purchase recorded' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Transfer
router.post('/transfers', checkRole(['admin', 'logistics']), (req, res) => {
    const { asset_id, source_base_id, dest_base_id, quantity, user_id } = req.body;
    try {
        // Deduct Source
        // Alasql UPDATE with calculation supports standard syntax
        dbRun("UPDATE inventory SET quantity = quantity - ? WHERE base_id = ? AND asset_id = ?", [quantity, source_base_id, asset_id]);

        // Add Dest
        upsertInventory(dest_base_id, asset_id, quantity);

        dbRun("INSERT INTO transactions (type, asset_id, source_base_id, dest_base_id, quantity, user_id, date) VALUES ('TRANSFER', ?, ?, ?, ?, ?, NOW())",
            [asset_id, source_base_id, dest_base_id, quantity, user_id]);

        res.json({ message: 'Transfer successful' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Assignments
router.post('/assignments', checkRole(['admin', 'commander']), (req, res) => {
    const { asset_id, base_id, quantity, type, user_id } = req.body;
    try {
        if (type === 'EXPEND') {
            dbRun("UPDATE inventory SET quantity = quantity - ? WHERE base_id = ? AND asset_id = ?", [quantity, base_id, asset_id]);
        }
        dbRun("INSERT INTO transactions (type, asset_id, source_base_id, quantity, user_id, date) VALUES (?, ?, ?, ?, ?, NOW())",
            [type, asset_id, base_id, quantity, user_id]);

        res.json({ message: `${type} recorded` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/history', (req, res) => {
    const { base_id } = req.query;
    try {
        let sql = `
            SELECT t.*, a.name as asset_name, u.username as user_name,
                   b1.name as source_base, b2.name as dest_base
            FROM transactions t
            JOIN assets a ON t.asset_id = a.id
            LEFT JOIN users u ON t.user_id = u.id
            LEFT JOIN bases b1 ON t.source_base_id = b1.id
            LEFT JOIN bases b2 ON t.dest_base_id = b2.id
            WHERE 1=1
        `;
        let params = [];
        if (base_id) {
            sql += " AND (t.source_base_id = ? OR t.dest_base_id = ?)";
            params.push(base_id, base_id);
        }
        sql += " ORDER BY t.date DESC"; // Alasql supports ORDER BY

        const rows = dbAll(sql, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use('/api', router);

// Export for Netlify Functions
module.exports.handler = serverless(app);

// Allow local execution
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
