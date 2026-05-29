const express = require('express');
const db = require('../db');
const { requireAuth, requireStudent } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireStudent);

function generateMathQuestion(difficulty) {
  const ops = ['+', '-', '*'];
  let a, b, op, answer, question_text;

  if (difficulty === 'easy') {
    a = Math.floor(Math.random() * 20) + 1;
    b = Math.floor(Math.random() * 20) + 1;
    op = ops[Math.floor(Math.random() * 2)];
    if (op === '-' && b > a) [a, b] = [b, a];
  } else if (difficulty === 'medium') {
    a = Math.floor(Math.random() * 50) + 10;
    b = Math.floor(Math.random() * 20) + 1;
    op = ops[Math.floor(Math.random() * 3)];
    if (op === '-' && b > a) [a, b] = [b, a];
  } else {
    a = Math.floor(Math.random() * 100) + 20;
    b = Math.floor(Math.random() * 50) + 10;
    op = ops[Math.floor(Math.random() * 3)];
    if (op === '-' && b > a) [a, b] = [b, a];
  }

  if (op === '+') answer = a + b;
  else if (op === '-') answer = a - b;
  else answer = a * b;

  question_text = `What is ${a} ${op} ${b}?`;

  const correctStr = answer.toString();
  const wrongs = new Set();
  while (wrongs.size < 3) {
    const offset = Math.floor(Math.random() * 10) + 1;
    const wrong = answer + (Math.random() > 0.5 ? offset : -offset);
    if (wrong !== answer) wrongs.add(wrong.toString());
  }

  const allOptions = [correctStr, ...wrongs];
  for (let i = allOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
  }

  const labels = ['A', 'B', 'C', 'D'];
  const options = allOptions.map((val, i) => ({
    option_label: labels[i],
    option_text: val,
    is_correct: val === correctStr ? 1 : 0
  }));

  return { type: 'generated', difficulty, question_text, answer: correctStr, options };
}

router.get('/dashboard', async (req, res) => {
  try {
    const assignments = await db.all(`
      SELECT a.id, a.status, a.due_date, a.assigned_at,
        q.id as question_id, q.question_text, q.type, q.difficulty, q.answer,
        u.name as parent_name
      FROM assignments a
      JOIN questions q ON q.id = a.question_id
      JOIN users u ON u.id = a.parent_id
      WHERE a.student_id = $1 AND a.status = 'pending'
      ORDER BY a.assigned_at DESC
    `, [req.user.id]);

    const assignmentsWithOptions = await Promise.all(assignments.map(async a => ({
      ...a,
      options: await db.all('SELECT * FROM question_options WHERE question_id = $1', [a.question_id])
    })));

    const stats = await db.get(`
      SELECT COUNT(*)::int as total, COALESCE(SUM(is_correct), 0)::int as correct
      FROM attempts WHERE student_id = $1
    `, [req.user.id]);

    const recentAttempts = await db.all(`
      SELECT att.is_correct, att.attempted_at, q.question_text, q.difficulty
      FROM attempts att JOIN questions q ON q.id = att.question_id
      WHERE att.student_id = $1
      ORDER BY att.attempted_at DESC LIMIT 10
    `, [req.user.id]);

    const parents = await db.all(`
      SELECT u.name FROM users u
      JOIN parent_student_links psl ON psl.parent_id = u.id
      WHERE psl.student_id = $1
    `, [req.user.id]);

    res.json({ assignments: assignmentsWithOptions, stats, recentAttempts, parents });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

router.get('/pending-assignments', async (req, res) => {
  try {
    const assignments = await db.all(`
      SELECT a.id as assignment_id, q.id as question_id, q.question_text, q.type, q.difficulty, q.answer
      FROM assignments a
      JOIN questions q ON q.id = a.question_id
      WHERE a.student_id = $1 AND a.status = 'pending'
      ORDER BY a.assigned_at ASC
    `, [req.user.id]);

    const withOptions = await Promise.all(assignments.map(async a => ({
      ...a,
      from_assignment: true,
      options: (await db.all('SELECT * FROM question_options WHERE question_id = $1', [a.question_id]))
        .map(o => ({ option_label: o.option_label, option_text: o.option_text, is_correct: o.is_correct }))
    })));

    res.json({ assignments: withOptions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load pending assignments' });
  }
});

router.get('/practice', async (req, res) => {
  const difficulty = ['easy', 'medium', 'hard'].includes(req.query.difficulty)
    ? req.query.difficulty
    : 'easy';

  try {
    const pending = await db.get(`
      SELECT a.id as assignment_id, q.id as question_id, q.question_text, q.type, q.difficulty, q.answer
      FROM assignments a
      JOIN questions q ON q.id = a.question_id
      WHERE a.student_id = $1 AND a.status = 'pending'
      ORDER BY a.assigned_at ASC
      LIMIT 1
    `, [req.user.id]);

    if (pending) {
      const options = await db.all('SELECT * FROM question_options WHERE question_id = $1', [pending.question_id]);
      return res.json({
        ...pending,
        from_assignment: true,
        options: options.map(o => ({ option_label: o.option_label, option_text: o.option_text, is_correct: o.is_correct }))
      });
    }
  } catch (_) {}

  res.json(generateMathQuestion(difficulty));
});

router.post('/submit', async (req, res) => {
  const { question_id, answer_given, assignment_id, is_generated, difficulty } = req.body;
  if (!answer_given) return res.status(400).json({ error: 'Answer required' });

  try {
    if (is_generated) {
      const { question_text, answer } = req.body;
      if (!question_text || !answer) return res.status(400).json({ error: 'Missing generated question data' });

      const result = await db.run(
        "INSERT INTO questions (created_by, type, difficulty, question_text, answer) VALUES (NULL, 'generated', $1, $2, $3) RETURNING id",
        [difficulty || 'easy', question_text, answer]
      );
      const questionId = result.rows[0].id;
      const is_correct = answer_given.trim() === answer.trim() ? 1 : 0;

      await db.run(
        'INSERT INTO attempts (student_id, question_id, answer_given, is_correct) VALUES ($1, $2, $3, $4)',
        [req.user.id, questionId, answer_given, is_correct]
      );

      return res.json({ is_correct: is_correct === 1, correct_answer: answer });
    }

    if (!question_id) return res.status(400).json({ error: 'question_id required' });
    const question = await db.get('SELECT * FROM questions WHERE id = $1', [question_id]);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const is_correct = answer_given.trim().toLowerCase() === question.answer.trim().toLowerCase() ? 1 : 0;

    await db.run(
      'INSERT INTO attempts (student_id, question_id, assignment_id, answer_given, is_correct) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, question_id, assignment_id || null, answer_given, is_correct]
    );

    if (assignment_id) {
      await db.run(
        "UPDATE assignments SET status = 'completed' WHERE id = $1 AND student_id = $2",
        [assignment_id, req.user.id]
      );
    }

    res.json({ is_correct: is_correct === 1, correct_answer: question.answer });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

module.exports = router;
