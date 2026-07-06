const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8765;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// --- API Endpoints ---

// Login / Register
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (row) {
      res.json(row);
    } else {
      db.run(`INSERT INTO users (username) VALUES (?)`, [username], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ username, score: 0, predictions_made: 0 });
      });
    }
  });
});

// Submit a prediction
app.post('/api/predict', (req, res) => {
  const { username, question_id, answer } = req.body;
  
  if (!username || !question_id || !answer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Insert or update prediction
  db.run(
    `INSERT INTO predictions (username, question_id, answer) 
     VALUES (?, ?, ?) 
     ON CONFLICT(username, question_id) DO UPDATE SET answer=excluded.answer, status='PENDING'`,
    [username, question_id, answer],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // Update predictions_made count
      db.run(`UPDATE users SET predictions_made = (SELECT count(*) FROM predictions WHERE username = ?) WHERE username = ?`, [username, username]);
      
      res.json({ success: true, message: 'Prediction saved' });
    }
  );
});

// Get User's Predictions
app.get('/api/predictions/:username', (req, res) => {
  const { username } = req.params;
  db.all(`SELECT * FROM predictions WHERE username = ?`, [username], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get Leaderboard
app.get('/api/leaderboard', (req, res) => {
  db.all(`SELECT username, score, predictions_made FROM users ORDER BY score DESC, predictions_made DESC LIMIT 100`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Admin Resolve Endpoint (Updates scores based on real-world results)
// Expected body format: { "1": "YES", "2": "NO", ... }
app.post('/api/admin/resolve', (req, res) => {
  const answers = req.body;
  
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    Object.keys(answers).forEach(question_id => {
      const correctAnswer = answers[question_id];
      
      // Mark correct predictions
      db.run(`UPDATE predictions SET status = 'CORRECT' WHERE question_id = ? AND answer = ? AND status = 'PENDING'`, [question_id, correctAnswer]);
      
      // Mark incorrect predictions
      db.run(`UPDATE predictions SET status = 'INCORRECT' WHERE question_id = ? AND answer != ? AND status = 'PENDING'`, [question_id, correctAnswer]);
    });

    // Recalculate all user scores (1 point per correct answer)
    db.run(`
      UPDATE users 
      SET score = (
        SELECT count(*) FROM predictions 
        WHERE predictions.username = users.username AND status = 'CORRECT'
      )
    `, [], (err) => {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: err.message });
      }
      db.run("COMMIT");
      res.json({ success: true, message: 'Scores updated successfully' });
    });
  });
});

// Setup 24h Cron Job (Logs a reminder since we rely on manual resolution for real-world events)
cron.schedule('0 0 * * *', () => {
  console.log('[CRON] 24 hours passed. Awaiting admin resolution for daily predictions.');
  // Alternatively, if we had an automated oracle, it would fetch results and call the resolve logic here.
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
