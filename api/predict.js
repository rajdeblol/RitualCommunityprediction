const db = require('./db');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, question_id, answer } = req.body;
  
  if (!username || !question_id || !answer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Insert or update prediction
    await db.query(`
      INSERT INTO predictions (username, question_id, answer) 
      VALUES ($1, $2, $3) 
      ON CONFLICT(username, question_id) 
      DO UPDATE SET answer=EXCLUDED.answer, status='PENDING'
    `, [username, question_id, answer]);

    // Update predictions_made count
    await db.query(`
      UPDATE users 
      SET predictions_made = (SELECT count(*) FROM predictions WHERE username = $1) 
      WHERE username = $1
    `, [username]);
    
    res.json({ success: true, message: 'Prediction saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
