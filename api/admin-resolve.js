const db = require('./db');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const answers = req.body;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Invalid answers payload' });
  }

  const client = await (require('./db').query('SELECT 1').then(() => require('./db'))); // Hacky way to get pool, better to export pool directly, but this is fine for now. 
  // Wait, db.query doesn't support transactions easily unless we get a client.
  // Let's just do it sequentially since it's serverless and low traffic.
  
  try {
    const questionIds = Object.keys(answers);
    
    for (const qId of questionIds) {
      const correctAnswer = answers[qId];
      
      // Mark correct
      await db.query(`
        UPDATE predictions 
        SET status = 'CORRECT' 
        WHERE question_id = $1 AND answer = $2 AND status = 'PENDING'
      `, [qId, correctAnswer]);
      
      // Mark incorrect
      await db.query(`
        UPDATE predictions 
        SET status = 'INCORRECT' 
        WHERE question_id = $1 AND answer != $2 AND status = 'PENDING'
      `, [qId, correctAnswer]);
    }

    // Recalculate scores
    await db.query(`
      UPDATE users 
      SET score = (
        SELECT count(*) FROM predictions 
        WHERE predictions.username = users.username AND status = 'CORRECT'
      )
    `);

    res.json({ success: true, message: 'Scores updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
