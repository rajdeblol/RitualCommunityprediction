const db = require('./db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    const result = await db.query(`SELECT * FROM users WHERE username = $1`, [username]);
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      await db.query(`INSERT INTO users (username) VALUES ($1)`, [username]);
      res.json({ username, score: 0, predictions_made: 0 });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
