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

router.put('/student/:studentId/target', async (req, res) => {
  const n = parseInt(req.body.correct_required);
  if (isNaN(n) || n < 0) return res.status(400).json({ error: 'correct_required must be a non-negative integer' });

  try {
    const linked = await db.get(
      'SELECT id FROM parent_student_links WHERE parent_id = $1 AND student_id = $2',
      [req.user.id, req.params.studentId]
    );
    if (!linked) return res.status(403).json({ error: 'Student not linked to your account' });

    await db.run(
      'UPDATE parent_student_links SET correct_required = $1 WHERE parent_id = $2 AND student_id = $3',
      [n, req.user.id, req.params.studentId]
    );
    res.json({ correct_required: n });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update target' });
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

router.post('/assign-batch', async (req, res) => {
  const { student_id, question_ids, due_date, correct_required } = req.body;
  if (!student_id || !Array.isArray(question_ids) || question_ids.length === 0) {
    return res.status(400).json({ error: 'student_id and question_ids array required' });
  }
  if (question_ids.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 questions per assignment' });
  }

  const target = Math.max(1, Math.min(parseInt(correct_required) || question_ids.length, question_ids.length));

  try {
    const linked = await db.get(
      'SELECT id FROM parent_student_links WHERE parent_id = $1 AND student_id = $2',
      [req.user.id, student_id]
    );
    if (!linked) return res.status(403).json({ error: 'Student not linked to your account' });

    const batchResult = await db.run(
      'INSERT INTO assignment_batches (parent_id, student_id, correct_required) VALUES ($1, $2, $3) RETURNING id',
      [req.user.id, student_id, target]
    );
    const batchId = batchResult.rows[0].id;

    const ids = [];
    for (const qid of question_ids) {
      const owns = await db.get(
        'SELECT id FROM questions WHERE id = $1 AND created_by = $2',
        [qid, req.user.id]
      );
      if (!owns) continue;
      const result = await db.run(
        'INSERT INTO assignments (parent_id, student_id, question_id, due_date, batch_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [req.user.id, student_id, qid, due_date || null, batchId]
      );
      ids.push(result.rows[0].id);
    }

    res.json({ assigned: ids.length, message: `${ids.length} question(s) assigned as practice set` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign practice set' });
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

router.post('/questions/generate', async (req, res) => {
  const { count = 20, difficulty = 'mixed', topic = 'math' } = req.body;
  const safeCount = Math.min(Math.max(parseInt(count) || 20, 5), 50);

  const difficultyInstruction = difficulty === 'mixed'
    ? 'Mix difficulties: roughly 1/3 easy, 1/3 medium, 1/3 hard.'
    : `All questions should be ${difficulty} difficulty.`;

  const prompt = `Generate ${safeCount} ${topic} questions for primary/middle school students. ${difficultyInstruction}

Mix question types: some as "multiple_choice" (with 4 options A/B/C/D) and some as "word_problem" (open answer).

Use LaTeX for ALL mathematical expressions. Inline math must use $...$ delimiters. Examples: $3 + 4$, $\\frac{1}{2}$, $x^2 + 3x - 10 = 0$, $\\sqrt{25}$.

Return ONLY a valid JSON array, no markdown, no explanation. Each element must have:
- "type": "multiple_choice" or "word_problem"
- "difficulty": "easy", "medium", or "hard"
- "question_text": the question string (use LaTeX for all math)
- "answer": the correct answer string (plain text or LaTeX if needed; for multiple_choice, match the correct option_text exactly)
- "options": array of {label, text, is_correct} objects — required for multiple_choice, omit for word_problem (option text may use LaTeX)

Example element:
{"type":"multiple_choice","difficulty":"easy","question_text":"What is $3 + 4$?","answer":"$7$","options":[{"label":"A","text":"$6$","is_correct":0},{"label":"B","text":"$7$","is_correct":1},{"label":"C","text":"$8$","is_correct":0},{"label":"D","text":"$9$","is_correct":0}]}

Cover a wide variety of topics within ${topic}: arithmetic, fractions, geometry, algebra basics, word problems, percentages, ratios, etc. Make sure every question is different and interesting.

IMPORTANT: For word_problem questions, the answer must be a plain number only — do NOT include units (e.g. answer "12" not "12 apples", "3.5" not "3.5 km"). Students will be told that units don't matter.`;

  try {
    const aiRes = await fetch(process.env.AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gemma3:12b',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    });
    if (!aiRes.ok) throw new Error(`AI API error: ${aiRes.status}`);
    const aiData = await aiRes.json();
    const raw = (aiData.choices?.[0]?.message?.content || '').trim();
    const questions = JSON.parse(raw);

    if (!Array.isArray(questions)) throw new Error('Expected JSON array');

    const created = [];
    for (const q of questions) {
      if (!q.type || !q.difficulty || !q.question_text || !q.answer) continue;
      if (!['multiple_choice', 'word_problem'].includes(q.type)) continue;
      if (!['easy', 'medium', 'hard'].includes(q.difficulty)) continue;

      const result = await db.run(
        'INSERT INTO questions (created_by, type, difficulty, question_text, answer) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [req.user.id, q.type, q.difficulty, q.question_text, q.answer]
      );
      const questionId = result.rows[0].id;

      if (q.type === 'multiple_choice' && Array.isArray(q.options)) {
        for (const opt of q.options) {
          await db.run(
            'INSERT INTO question_options (question_id, option_label, option_text, is_correct) VALUES ($1, $2, $3, $4)',
            [questionId, opt.label, opt.text, opt.is_correct ? 1 : 0]
          );
        }
      }

      const saved = await db.get('SELECT * FROM questions WHERE id = $1', [questionId]);
      const opts = await db.all('SELECT * FROM question_options WHERE question_id = $1', [questionId]);
      created.push({ ...saved, options: opts });
    }

    res.json({ generated: created.length, questions: created });
  } catch (err) {
    console.error('AI generate error:', err.message);
    res.status(500).json({ error: 'Failed to generate questions: ' + err.message });
  }
});

module.exports = router;
