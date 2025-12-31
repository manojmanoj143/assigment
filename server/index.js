const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// Middleware for logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Mock Authentication/RBAC Middleware
// In a real app, this would verify a JWT token.
// Here we expect a header 'X-Role' and 'X-Base-ID' for simplicity in this demo.
const checkRole = (allowedRoles) => (req, res, next) => {
    const userRole = req.headers['x-role'];
    if (!userRole || (allowedRoles.length > 0 && !allowedRoles.includes(userRole))) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
};

// --- APIs ---

// Login (Mock)
app.post('/api/login', (req, res) => {
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
app.get('/api/bases', (req, res) => {
    db.all("SELECT * FROM bases", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get Assets
app.get('/api/assets', (req, res) => {
    db.all("SELECT * FROM assets", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Dashboard Stats
app.get('/api/dashboard', (req, res) => {
    const baseId = req.query.base_id; // Optional filter by base
    const type = req.query.type; // Optional filter by asset type

    // 1. Current Balances
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

    // 2. Net Movements (Purchases + In - Out) - This is complex to aggregate in one go, 
    // but we can fetch transaction sums.

    // We will return inventory first, then fetch movements.
    db.all(inventoryQuery, inventoryParams, (err, inventory) => {
        if (err) return res.status(500).json({ error: err.message });

        // Fetch movements
        let transQuery = `
            SELECT 
                t.type, 
                SUM(t.quantity) as total 
            FROM transactions t
            LEFT JOIN assets a ON t.asset_id = a.id
            WHERE 1=1
        `;
        const transParams = [];

        if (baseId) {
            // For Transfers, we need to handle source vs dest
            // If baseId is specified:
            // PURCHASE: dest_base_id = baseId
            // TRANSFER_IN: dest_base_id = baseId
            // TRANSFER_OUT: source_base_id = baseId
            // ASSIGN/EXPEND: dest_base_id (or source) - usually source for these.
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

            // Format movements
            const movements = {
                purchased: 0,
                transferred_in: 0,
                transferred_out: 0,
                assigned: 0,
                expended: 0
            };

            transactions.forEach(t => {
                if (t.type === 'PURCHASE') movements.purchased += t.total;
                if (t.type === 'TRANSFER_IN') movements.transferred_in += t.total; // Note: In DB we might store TRANSFER, and infer IN/OUT based on base. 
                // Let's assume we store TRANSFER and check base_id logic purely on read, 
                // BUT current schema has 'TRANSFER_IN'/'TRANSFER_OUT' as types? 
                // Implementation Details: 
                // If I store 'TRANSFER', I count it as IN if dest_base_id == filter_base, OUT if source_base_id == filter_base.
                // If types are explicit, it's easier.
                // Let's stick to using 'TRANSFER' type for both, and distinguish query-side if baseId is present.
                // However, the prompt asked for "Net Movements (Purchases + Transfer In - Transfer Out)".

                // My Schema has `type`. I'll use 'TRANSFER' in DB and derive labels here.
            });

            // Re-query for explicit IN/OUT if baseId is present
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
                        opening_balance: 0, // This would be calculated: Closing - Net Movement
                        closing_balance: inventorySize(inventory),
                        movements: {
                            purchased: 0,
                            transfer_in: 0,
                            transfer_out: 0,
                            assigned: 0,
                            expended: 0
                        }
                    };

                    preciseRows.forEach(r => {
                        if (r.movement_type === 'PURCHASE') stats.movements.purchased = r.total;
                        if (r.movement_type === 'TRANSFER_IN') stats.movements.transfer_in = r.total;
                        if (r.movement_type === 'TRANSFER_OUT') stats.movements.transfer_out = r.total;
                        if (r.movement_type === 'ASSIGN') stats.movements.assigned = r.total;
                        if (r.movement_type === 'EXPEND') stats.movements.expended = r.total;
                    });

                    // Net Movement
                    const net = stats.movements.purchased + stats.movements.transfer_in - stats.movements.transfer_out;
                    stats.opening_balance = stats.closing_balance - net; // Approximately

                    res.json(stats);
                });
            } else {
                // Global view
                res.json({ inventory, raw_transactions: transactions });
            }
        });
    });
});

function inventorySize(rows) {
    return rows.reduce((acc, r) => acc + r.current_balance, 0);
}


// Purchase
app.post('/api/purchases', checkRole(['admin', 'logistics']), (req, res) => {
    const { asset_id, base_id, quantity, user_id } = req.body;

    db.serialize(() => {
        // 1. Add Transaction
        db.run(`INSERT INTO transactions (type, asset_id, dest_base_id, quantity, user_id) VALUES ('PURCHASE', ?, ?, ?, ?)`,
            [asset_id, base_id, quantity, user_id]);

        // 2. Update Inventory
        db.run(`INSERT INTO inventory (base_id, asset_id, quantity) VALUES (?, ?, ?) 
                ON CONFLICT(base_id, asset_id) DO UPDATE SET quantity = quantity + ?`,
            [base_id, asset_id, quantity, quantity], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Purchase recorded successfully' });
            });
    });
});

// Transfer
app.post('/api/transfers', checkRole(['admin', 'logistics']), (req, res) => {
    const { asset_id, source_base_id, dest_base_id, quantity, user_id } = req.body;

    // Direct execution - allowing negative inventory as per user request
    db.serialize(() => {
        // Deduct from Source
        db.run("UPDATE inventory SET quantity = quantity - ? WHERE base_id = ? AND asset_id = ?", [quantity, source_base_id, asset_id]);

        // Add to Dest
        db.run(`INSERT INTO inventory (base_id, asset_id, quantity) VALUES (?, ?, ?) 
                ON CONFLICT(base_id, asset_id) DO UPDATE SET quantity = quantity + ?`,
            [dest_base_id, asset_id, quantity, quantity]);

        // Log Transaction
        db.run(`INSERT INTO transactions (type, asset_id, source_base_id, dest_base_id, quantity, user_id) 
                VALUES ('TRANSFER', ?, ?, ?, ?, ?)`,
            [asset_id, source_base_id, dest_base_id, quantity, user_id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Transfer successful' });
            });
    });
});

// Assignments/Expenditure
app.post('/api/assignments', checkRole(['admin', 'commander']), (req, res) => {
    const { asset_id, base_id, quantity, type, user_id } = req.body; // type = ASSIGN or EXPEND

    // Direct execution - allowing negative inventory as per user request
    db.serialize(() => {
        if (type === 'EXPEND') {
            // Remove from inventory
            db.run("UPDATE inventory SET quantity = quantity - ? WHERE base_id = ? AND asset_id = ?", [quantity, base_id, asset_id]);
        }
        // For ASSIGN, we just log it as per previous logic.

        db.run(`INSERT INTO transactions (type, asset_id, source_base_id, quantity, user_id) 
                VALUES (?, ?, ?, ?, ?)`,
            [type, asset_id, base_id, quantity, user_id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: `${type} recorded successfully` });
            });
    });
});

// History
app.get('/api/history', (req, res) => {
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

app.get('/', (req, res) => {
    res.send('Backend Server is Running. Please use the Frontend application (usually port 5173).');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
