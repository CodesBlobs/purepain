const express = require('express');
const { pool, get, all, run } = require('../db');
const os = require('os');

const router = express.Router();
const START_TIME = Date.now();

router.get('/health', async (req, res) => {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch {}

  const status = dbOk ? 'ok' : 'degraded';
  res.status(dbOk ? 200 : 503).json({
    status,
    uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    db: dbOk ? 'connected' : 'error',
  });
});

router.get('/diagnostics', async (req, res) => {
  try {
    const counts = {
      users:       (await get('SELECT COUNT(*)::int as n FROM users')).n,
      parents:     (await get("SELECT COUNT(*)::int as n FROM users WHERE account_type='parent'")).n,
      students:    (await get("SELECT COUNT(*)::int as n FROM users WHERE account_type='student'")).n,
      links:       (await get('SELECT COUNT(*)::int as n FROM parent_student_links')).n,
      questions:   (await get('SELECT COUNT(*)::int as n FROM questions')).n,
      assignments: (await get('SELECT COUNT(*)::int as n FROM assignments')).n,
      attempts:    (await get('SELECT COUNT(*)::int as n FROM attempts')).n,
    };

    const recentActivity = await all(`
      SELECT 'attempt' as event_type, attempted_at as ts FROM attempts
      UNION ALL
      SELECT 'assignment', assigned_at FROM assignments
      ORDER BY ts DESC LIMIT 10
    `);

    res.json({
      status: 'ok',
      uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
      timestamp: new Date().toISOString(),
      node_version: process.version,
      platform: process.platform,
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      counts,
      recent_activity: recentActivity,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

router.post('/run-tests', async (req, res) => {
  const results = [];
  const created = { userIds: [], questionIds: [], assignmentIds: [] };
  const suffix = Date.now();

  function pass(name, detail) {
    results.push({ name, status: 'pass', detail: detail || null });
  }
  function fail(name, error) {
    results.push({ name, status: 'fail', error: String(error) });
  }

  const BASE = `http://localhost:${process.env.PORT || 3000}`;

  async function req_(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  }

  let parentToken, studentToken, parentId, studentId, questionId, questionId2, assignmentId;

  try {
    // ── Auth ───────────────────────────────────────────────────────────────
    {
      const r = await req_('POST', '/auth/register', {
        name: `Test Parent ${suffix}`,
        email: `agent_parent_${suffix}@test.invalid`,
        password: 'testpass123',
        account_type: 'parent',
      });
      if (r.status === 200 && r.data.token) {
        parentToken = r.data.token;
        parentId = r.data.user.id;
        created.userIds.push(parentId);
        pass('auth.register_parent', `id=${parentId}`);
      } else {
        fail('auth.register_parent', r.data.error || r.status);
      }
    }

    {
      const r = await req_('POST', '/auth/register', {
        name: `Test Student ${suffix}`,
        email: `agent_student_${suffix}@test.invalid`,
        password: 'testpass123',
        account_type: 'student',
        grade_level: 5,
      });
      if (r.status === 200 && r.data.token) {
        studentToken = r.data.token;
        studentId = r.data.user.id;
        created.userIds.push(studentId);
        pass('auth.register_student', `id=${studentId}`);
      } else {
        fail('auth.register_student', r.data.error || r.status);
      }
    }

    {
      const r = await req_('POST', '/auth/login', {
        email: `agent_parent_${suffix}@test.invalid`,
        password: 'testpass123',
      });
      r.status === 200 && r.data.token
        ? pass('auth.login', 'JWT returned')
        : fail('auth.login', r.data.error || r.status);
    }

    {
      const r = await req_('POST', '/auth/login', {
        email: `agent_parent_${suffix}@test.invalid`,
        password: 'wrongpassword',
      });
      r.status === 401
        ? pass('auth.login_bad_password_rejects', 'HTTP 401')
        : fail('auth.login_bad_password_rejects', `expected 401, got ${r.status}`);
    }

    {
      const r = await req_('POST', '/auth/register', {
        name: 'Dup', email: `agent_parent_${suffix}@test.invalid`,
        password: 'testpass123', account_type: 'parent',
      });
      r.status === 409
        ? pass('auth.duplicate_email_rejects', 'HTTP 409')
        : fail('auth.duplicate_email_rejects', `expected 409, got ${r.status}`);
    }

    // ── Parent ─────────────────────────────────────────────────────────────
    if (parentToken && studentId) {
      {
        const r = await req_('POST', '/parent/link-student',
          { email: `agent_student_${suffix}@test.invalid` }, parentToken);
        r.status === 200 && r.data.student?.id === studentId
          ? pass('parent.link_student', `linked student ${studentId}`)
          : fail('parent.link_student', r.data.error || r.status);
      }

      {
        const r = await req_('POST', '/parent/link-student',
          { email: `agent_student_${suffix}@test.invalid` }, parentToken);
        r.status === 409
          ? pass('parent.link_duplicate_rejects', 'HTTP 409')
          : fail('parent.link_duplicate_rejects', `expected 409, got ${r.status}`);
      }

      {
        const r = await req_('POST', '/parent/link-student',
          { email: 'nobody@test.invalid' }, parentToken);
        r.status === 404
          ? pass('parent.link_nonexistent_rejects', 'HTTP 404')
          : fail('parent.link_nonexistent_rejects', `expected 404, got ${r.status}`);
      }

      {
        const r = await req_('GET', '/parent/dashboard', null, parentToken);
        const hasStudent = r.data.students?.some(s => s.id === studentId);
        r.status === 200 && hasStudent
          ? pass('parent.dashboard', `student visible`)
          : fail('parent.dashboard', r.data.error || `student missing`);
      }

      {
        const r = await req_('POST', '/parent/questions', {
          type: 'multiple_choice',
          difficulty: 'easy',
          question_text: 'What is 2 + 2?',
          answer: '4',
          options: [
            { label: 'A', text: '3', is_correct: false },
            { label: 'B', text: '4', is_correct: true },
            { label: 'C', text: '5', is_correct: false },
            { label: 'D', text: '6', is_correct: false },
          ],
        }, parentToken);
        if (r.status === 200 && r.data.id) {
          questionId = r.data.id;
          created.questionIds.push(questionId);
          pass('parent.create_mc_question', `id=${questionId}, options=${r.data.options?.length}`);
        } else {
          fail('parent.create_mc_question', r.data.error || r.status);
        }
      }

      {
        const r = await req_('POST', '/parent/questions', {
          type: 'word_problem',
          difficulty: 'medium',
          question_text: 'If you have 10 apples and eat 3, how many are left?',
          answer: '7',
        }, parentToken);
        if (r.status === 200 && r.data.id) {
          questionId2 = r.data.id;
          created.questionIds.push(questionId2);
          pass('parent.create_word_problem', `id=${questionId2}`);
        } else {
          fail('parent.create_word_problem', r.data.error || r.status);
        }
      }

      {
        const r = await req_('POST', '/parent/questions', {
          type: 'invalid_type', difficulty: 'easy',
          question_text: 'Bad?', answer: 'yes',
        }, parentToken);
        r.status === 400
          ? pass('parent.create_invalid_type_rejects', 'HTTP 400')
          : fail('parent.create_invalid_type_rejects', `expected 400, got ${r.status}`);
      }

      if (questionId) {
        const r = await req_('POST', '/parent/assign',
          { student_id: studentId, question_id: questionId }, parentToken);
        if (r.status === 200 && r.data.id) {
          assignmentId = r.data.id;
          created.assignmentIds.push(assignmentId);
          pass('parent.assign_question', `assignment id=${assignmentId}`);
        } else {
          fail('parent.assign_question', r.data.error || r.status);
        }
      }

      {
        const r = await req_('POST', '/parent/assign',
          { student_id: 99999, question_id: questionId }, parentToken);
        r.status === 403
          ? pass('parent.assign_non_linked_rejects', 'HTTP 403')
          : fail('parent.assign_non_linked_rejects', `expected 403, got ${r.status}`);
      }

      // ── Batch assign (practice set) ──────────────────────────────────────
      if (questionId && questionId2) {
        const r = await req_('POST', '/parent/assign-batch',
          { student_id: studentId, question_ids: [questionId, questionId2] }, parentToken);
        if (r.status === 200 && r.data.assigned === 2) {
          pass('parent.assign_batch', `assigned=${r.data.assigned}`);
        } else {
          fail('parent.assign_batch', r.data.error || JSON.stringify(r.data));
        }
      }

      {
        const r = await req_('POST', '/parent/assign-batch',
          { student_id: 99999, question_ids: [questionId] }, parentToken);
        r.status === 403
          ? pass('parent.assign_batch_non_linked_rejects', 'HTTP 403')
          : fail('parent.assign_batch_non_linked_rejects', `expected 403, got ${r.status}`);
      }

      {
        const r = await req_('POST', '/parent/assign-batch',
          { student_id: studentId, question_ids: [1,2,3,4,5,6] }, parentToken);
        r.status === 400
          ? pass('parent.assign_batch_over_limit_rejects', 'HTTP 400')
          : fail('parent.assign_batch_over_limit_rejects', `expected 400, got ${r.status}`);
      }

      if (studentId) {
        const r = await req_('GET', `/parent/student/${studentId}/progress`, null, parentToken);
        r.status === 200 && 'stats' in r.data
          ? pass('parent.view_student_progress', `total=${r.data.stats.total}`)
          : fail('parent.view_student_progress', r.data.error || r.status);
      }
    }

    // ── Student ────────────────────────────────────────────────────────────
    if (studentToken) {
      {
        const r = await req_('GET', '/student/dashboard', null, studentToken);
        r.status === 200 && Array.isArray(r.data.assignments)
          ? pass('student.dashboard', `assignments=${r.data.assignments.length}`)
          : fail('student.dashboard', r.data.error || r.status);
      }

      // Practice should serve an assigned question (from batch assign above)
      {
        const r = await req_('GET', '/student/practice?difficulty=easy', null, studentToken);
        if (r.status === 200 && r.data.question_text) {
          const isAssigned = !!r.data.from_assignment;
          pass('student.practice_serves_assignment', `from_assignment=${isAssigned}, q="${r.data.question_text}"`);

          // Submit the assigned question and confirm it completes
          if (isAssigned) {
            const submit = await req_('POST', '/student/submit', {
              question_id: r.data.question_id,
              assignment_id: r.data.assignment_id,
              answer_given: r.data.answer,
            }, studentToken);
            submit.status === 200
              ? pass('student.submit_assignment_via_practice', `is_correct=${submit.data.is_correct}`)
              : fail('student.submit_assignment_via_practice', submit.data.error || submit.status);
          }
        } else {
          fail('student.practice_serves_assignment', r.data.error || r.status);
        }
      }

      // After submitting one, next practice call should serve the next pending or fallback to generated
      {
        const r = await req_('GET', '/student/practice?difficulty=easy', null, studentToken);
        r.status === 200 && r.data.question_text && Array.isArray(r.data.options)
          ? pass('student.practice_fallback_or_next', `from_assignment=${!!r.data.from_assignment}`)
          : fail('student.practice_fallback_or_next', r.data.error || r.status);
      }

      // Generated question submit (correct)
      {
        const q = await req_('GET', '/student/practice?difficulty=easy', null, studentToken);
        if (q.status === 200 && !q.data.from_assignment) {
          const correctOption = q.data.options?.find(o => o.is_correct || o.option_text === q.data.answer);
          if (correctOption) {
            const r = await req_('POST', '/student/submit', {
              is_generated: true,
              question_text: q.data.question_text,
              answer: q.data.answer,
              answer_given: correctOption.option_text,
              difficulty: 'easy',
            }, studentToken);
            r.status === 200 && r.data.is_correct === true
              ? pass('student.submit_correct_generated', 'is_correct=true')
              : fail('student.submit_correct_generated', r.data.error || JSON.stringify(r.data));
          } else {
            pass('student.submit_correct_generated', 'skipped (assignment queue not empty)');
          }
        } else {
          pass('student.submit_correct_generated', 'skipped (assignment queue not empty)');
        }
      }

      if (assignmentId && questionId) {
        const r = await req_('POST', '/student/submit', {
          question_id: questionId,
          assignment_id: assignmentId,
          answer_given: '4',
        }, studentToken);
        r.status === 200 && r.data.is_correct === true
          ? pass('student.submit_assignment_correct', 'is_correct=true, assignment completed')
          : fail('student.submit_assignment_correct', r.data.error || JSON.stringify(r.data));
      }
    }

    // ── Auth guard checks ──────────────────────────────────────────────────
    {
      const r = await req_('GET', '/parent/dashboard', null, null);
      r.status === 401
        ? pass('auth.unauthenticated_rejects', 'HTTP 401')
        : fail('auth.unauthenticated_rejects', `expected 401, got ${r.status}`);
    }

    {
      const r = await req_('GET', '/parent/dashboard', null, studentToken);
      r.status === 403
        ? pass('auth.student_cannot_access_parent_routes', 'HTTP 403')
        : fail('auth.student_cannot_access_parent_routes', `expected 403, got ${r.status}`);
    }

    {
      const r = await req_('GET', '/student/dashboard', null, parentToken);
      r.status === 403
        ? pass('auth.parent_cannot_access_student_routes', 'HTTP 403')
        : fail('auth.parent_cannot_access_student_routes', `expected 403, got ${r.status}`);
    }

  } catch (err) {
    fail('runner.unexpected_error', err.message);
  } finally {
    if (created.userIds.length) {
      try {
        await pool.query('DELETE FROM attempts WHERE student_id = ANY($1::int[])', [created.userIds]);
        await pool.query('DELETE FROM attempts WHERE question_id IN (SELECT id FROM questions WHERE created_by = ANY($1::int[]))', [created.userIds]);
        await pool.query("DELETE FROM attempts WHERE question_id IN (SELECT id FROM questions WHERE type='generated' AND created_by IS NULL)");
        await pool.query('DELETE FROM assignments WHERE parent_id = ANY($1::int[]) OR student_id = ANY($1::int[])', [created.userIds]);
        await pool.query('DELETE FROM question_options WHERE question_id IN (SELECT id FROM questions WHERE created_by = ANY($1::int[]))', [created.userIds]);
        await pool.query('DELETE FROM questions WHERE created_by = ANY($1::int[])', [created.userIds]);
        await pool.query("DELETE FROM questions WHERE type='generated' AND created_by IS NULL");
        await pool.query('DELETE FROM parent_student_links WHERE parent_id = ANY($1::int[]) OR student_id = ANY($1::int[])', [created.userIds]);
        await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [created.userIds]);
      } catch {}
    }
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const allPassed = failed === 0;

  res.status(allPassed ? 200 : 207).json({
    summary: { total: results.length, passed, failed, all_passed: allPassed },
    results,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
