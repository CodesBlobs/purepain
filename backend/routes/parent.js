const express = require('express');
const db = require('../db');
const { requireAuth, requireParent } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireParent);

router.get('/dashboard', async (req, res) => {
  try {
    const students = await db.all(`
      SELECT u.id, u.name, u.email, u.grade_level,
        (SELECT COUNT(*) FROM assignments a WHERE a.student_id = u.id AND a.parent_id = $1 AND a.status = 'pending')::int as pending_count,
        (SELECT COUNT(*) FROM assignments a WHERE a.student_id = u.id AND a.parent_id = $2 AND a.status = 'completed')::int as completed_count,
        (SELECT COUNT(*) FROM attempts att WHERE att.student_id = u.id AND att.is_correct = 1)::int as correct_count,
        (SELECT COUNT(*) FROM attempts att WHERE att.student_id = u.id)::int as total_attempts
      FROM users u
      JOIN parent_student_links psl ON psl.student_id = u.id
      WHERE psl.parent_id = $3
    `, [req.user.id, req.user.id, req.user.id]);

    const my_questions = await db.all(
      'SELECT * FROM questions WHERE created_by = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({ students, my_questions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

router.post('/link-student', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Student email required' });

  try {
    const existing = await db.get(
      'SELECT COUNT(*)::int as count FROM parent_student_links WHERE parent_id = $1',
      [req.user.id]
    );
    if (existing.count >= 2) {
      return res.status(400).json({ error: 'You can only link up to 2 students' });
    }

    const student = await db.get(
      "SELECT id, name, email, account_type FROM users WHERE email = $1 AND account_type = 'student'",
      [email.toLowerCase().trim()]
    );
    if (!student) return res.status(404).json({ error: 'No student account found with that email' });

    const alreadyLinked = await db.get(
      'SELECT id FROM parent_student_links WHERE parent_id = $1 AND student_id = $2',
      [req.user.id, student.id]
    );
    if (alreadyLinked) return res.status(409).json({ error: 'Student already linked' });

    await db.run(
      'INSERT INTO parent_student_links (parent_id, student_id) VALUES ($1, $2)',
      [req.user.id, student.id]
    );
    res.json({ message: 'Student linked successfully', student });
  } catch (err) {
    res.status(500).json({ error: 'Failed to link student' });
  }
});

router.delete('/link-student/:studentId', async (req, res) => {
  try {
    await db.run(
      'DELETE FROM parent_student_links WHERE parent_id = $1 AND student_id = $2',
      [req.user.id, req.params.studentId]
    );
    res.json({ message: 'Student unlinked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlink student' });
  }
});

router.post('/questions', async (req, res) => {
  const { type, difficulty, question_text, answer, options } = req.body;

  if (!type || !difficulty || !question_text || !answer) {
    return res.status(400).json({ error: 'type, difficulty, question_text, and answer are required' });
  }
  if (!['multiple_choice', 'word_problem'].includes(type)) {
    return res.status(400).json({ error: 'Invalid question type' });
  }
  if (!['easy', 'medium', 'hard'].includes(difficulty)) {
    return res.status(400).json({ error: 'Invalid difficulty' });
  }

  try {
    const result = await db.run(
      'INSERT INTO questions (created_by, type, difficulty, question_text, answer) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.user.id, type, difficulty, question_text, answer]
    );
    const questionId = result.rows[0].id;

    if (type === 'multiple_choice' && Array.isArray(options) && options.length > 0) {
      for (const opt of options) {
        await db.run(
          'INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES ($1, $2, $3, $4)',
          [questionId, opt.label, opt.text, opt.is_correct ? 1 : 0]
        );
      }
    }

    const question = await db.get('SELECT * FROM questions WHERE id = $1', [questionId]);
    const questionOptions = await db.all('SELECT * FROM question_options WHERE question_id = $1', [questionId]);
    res.json({ ...question, options: questionOptions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create question' });
  }
});

router.get('/questions', async (req, res) => {
  try {
    const questions = await db.all(
      'SELECT * FROM questions WHERE created_by = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const withOptions = await Promise.all(questions.map(async q => ({
      ...q,
      options: await db.all('SELECT * FROM question_options WHERE question_id = $1', [q.id])
    })));
    res.json(withOptions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load questions' });
  }
});

router.delete('/questions/:id', async (req, res) => {
  try {
    const q = await db.get(
      'SELECT id FROM questions WHERE id = $1 AND created_by = $2',
      [req.params.id, req.user.id]
    );
    if (!q) return res.status(404).json({ error: 'Question not found' });
    await db.run('DELETE FROM questions WHERE id = $1', [req.params.id]);
    res.json({ message: 'Question deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

router.post('/assign', async (req, res) => {
  const { student_id, question_id, due_date } = req.body;
  if (!student_id || !question_id) {
    return res.status(400).json({ error: 'student_id and question_id required' });
  }

  try {
    const linked = await db.get(
      'SELECT id FROM parent_student_links WHERE parent_id = $1 AND student_id = $2',
      [req.user.id, student_id]
    );
    if (!linked) return res.status(403).json({ error: 'Student not linked to your account' });

    const result = await db.run(
      'INSERT INTO assignments (parent_id, student_id, question_id, due_date) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.user.id, student_id, question_id, due_date || null]
    );
    res.json({ id: result.rows[0].id, message: 'Question assigned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign question' });
  }
});

router.get('/student/:studentId/progress', async (req, res) => {
  try {
    const linked = await db.get(
      'SELECT id FROM parent_student_links WHERE parent_id = $1 AND student_id = $2',
      [req.user.id, req.params.studentId]
    );
    if (!linked) return res.status(403).json({ error: 'Not authorized' });

    const attempts = await db.all(`
      SELECT att.id, att.answer_given, att.is_correct, att.attempted_at,
        q.question_text, q.type, q.difficulty, q.answer
      FROM attempts att
      JOIN questions q ON q.id = att.question_id
      WHERE att.student_id = $1
      ORDER BY att.attempted_at DESC
      LIMIT 50
    `, [req.params.studentId]);

    const stats = await db.get(`
      SELECT COUNT(*)::int as total, COALESCE(SUM(is_correct), 0)::int as correct
      FROM attempts WHERE student_id = $1
    `, [req.params.studentId]);

    res.json({ attempts, stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load progress' });
  }
});

module.exports = router;
