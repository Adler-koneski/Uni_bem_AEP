import express from 'express';
import dotenv from 'dotenv';
import { pool } from './db.js';
import cors from 'cors';               // ✅ IMPORTADO AQUI

dotenv.config();
const app = express();

app.use(cors());                       // ✅ ATIVADO AQUI
app.use(express.json());

function handleError(res, err) {
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
}

// HEALTHCHECK
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ======================= DONORS =======================
app.get('/api/donors', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM donors ORDER BY name');
    res.json(rows);
  } catch (e) { handleError(res, e); }
});

app.post('/api/donors', async (req, res) => {
  try {
    const { name, document, contact } = req.body;
    const [r] = await pool.query(
      'INSERT INTO donors(name, document, contact) VALUES (?,?,?)',
      [name, document, contact]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) { handleError(res, e); }
});

// ======================= INSTITUTIONS =======================
app.get('/api/institutions', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM institutions ORDER BY name');
    res.json(rows);
  } catch (e) { handleError(res, e); }
});

app.post('/api/institutions', async (req, res) => {
  try {
    const { name, cnpj, contact } = req.body;
    const [r] = await pool.query(
      'INSERT INTO institutions(name, cnpj, contact) VALUES (?,?,?)',
      [name, cnpj, contact]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) { handleError(res, e); }
});

// ======================= ITEMS =======================
app.get('/api/items', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM items ORDER BY name');
    res.json(rows);
  } catch (e) { handleError(res, e); }
});

app.post('/api/items', async (req, res) => {
  try {
    const { name, category, unit } = req.body;
    const [r] = await pool.query(
      'INSERT INTO items(name, category, unit) VALUES (?,?,?)',
      [name, category, unit]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) { handleError(res, e); }
});

// ======================= DONATIONS (LOTS + STOCK) =======================
app.post('/api/donations', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { donor_id, received_at, items } = req.body; 
    await conn.beginTransaction();

    const [d] = await conn.query(
      'INSERT INTO donations(donor_id, received_at) VALUES (?,?)',
      [donor_id, received_at]
    );
    const donation_id = d.insertId;

    for (const it of items) {
      let lotId;
      const [lot] = await conn.query(
        'SELECT id FROM lots WHERE item_id=? AND lot_code=? AND expires_at=?',
        [it.item_id, it.lot_code, it.expires_at]
      );

      if (lot.length) {
        lotId = lot[0].id;
      } else {
        const [ins] = await conn.query(
          'INSERT INTO lots(item_id, lot_code, expires_at) VALUES (?,?,?)',
          [it.item_id, it.lot_code, it.expires_at]
        );
        lotId = ins.insertId;
      }

      await conn.query(
        'INSERT INTO donation_items(donation_id, lot_id, quantity) VALUES (?,?,?)',
        [donation_id, lotId, it.quantity]
      );
    }

    await conn.commit();
    res.status(201).json({ donation_id });

  } catch (e) {
    await conn.rollback();
    handleError(res, e);
  } finally {
    conn.release();
  }
});

// ======================= DELIVERIES =======================
app.post('/api/deliveries', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { institution_id, delivered_at, items } = req.body; 
    await conn.beginTransaction();

    const [d] = await conn.query(
      'INSERT INTO deliveries(institution_id, delivered_at) VALUES (?,?)',
      [institution_id, delivered_at]
    );
    const delivery_id = d.insertId;

    for (const it of items) {
      const [stk] = await conn.query(
        'SELECT quantity FROM stock WHERE lot_id=? FOR UPDATE',
        [it.lot_id]
      );
      const current = (stk.length ? stk[0].quantity : 0);
      if (current < it.quantity) throw new Error('Saldo insuficiente no lote ' + it.lot_id);

      await conn.query(
        'INSERT INTO delivery_items(delivery_id, lot_id, quantity) VALUES (?,?,?)',
        [delivery_id, it.lot_id, it.quantity]
      );
    }

    await conn.commit();
    res.status(201).json({ delivery_id });

  } catch (e) {
    await conn.rollback();
    handleError(res, e);
  } finally {
    conn.release();
  }
});

// ======================= STOCK & REPORTS =======================
app.get('/api/stock', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_estoque_validade ORDER BY days_to_expiry ASC');
    res.json(rows);
  } catch (e) { handleError(res, e); }
});

app.get('/api/reports/donations', async (req, res) => {
  try {
    const { start, end } = req.query;
    const [rows] = await pool.query(
      'SELECT * FROM vw_doacoes_periodo WHERE received_at BETWEEN ? AND ? ORDER BY received_at',
      [start, end]
    );
    res.json(rows);
  } catch (e) { handleError(res, e); }
});

// ======================= START SERVER =======================
const port = process.env.PORT || 3000;
app.listen(port, () => console.log('API on http://localhost:' + port));
