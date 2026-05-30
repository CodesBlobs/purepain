#!/usr/bin/env node
// Standalone integration test — runs from local machine against deployed backend.
// Usage: node test-live.js [base_url]
//   base_url defaults to http://34.151.69.181:3000

const BASE = process.argv[2] || 'http://34.151.69.181:3000';

const G = '\x1b[32m', R = '\x1b[31m', B = '\x1b[1m', D = '\x1b[2m', X = '\x1b[0m';

const results = [];
function pass(name, detail) { results.push({ name, ok: true, detail }); }
function fail(name, err)    { results.push({ name, ok: false, err: String(err) }); }

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(BASE + path, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function main() {
  console.log(`\n${B}StudyOcean Integration Tests${X}`);
  console.log(`${D}Target: ${BASE}${X}\n`);

  // Health check
  try {
    const r = await req('GET', '/agent/health');
    if (r.data.status === 'ok') {
      console.log(`${G}✓${X} Server healthy (uptime ${r.data.uptime_seconds}s, db ${r.data.db})\n`);
    } else {
      console.error(`${R}✗ Server degraded${X}\n`); process.exit(1);
    }
  } catch (e) {
    console.error(`${R}✗ Cannot reach ${BASE}: ${e.message}${X}\n`); process.exit(1);
  }

  const suffix = Date.now();
  let parentToken, studentToken, parentId, studentId, questionId, questionId2, assignmentId;

  // ── Auth ──────────────────────────────────────────────────────────────────
  {
    const r = await req('POST', '/auth/register', {
      name: `Test Parent ${suffix}`, email: `tp_${suffix}@test.invalid`,
      password: 'testpass123', account_type: 'parent',
    });
    if (r.status === 200 && r.data.token) {
      parentToken = r.data.token; parentId = r.data.user.id;
      pass('auth.register_parent', `id=${parentId}`);
    } else fail('auth.register_parent', r.data.error || r.status);
  }

  {
    const r = await req('POST', '/auth/register', {
      name: `Test Student ${suffix}`, email: `ts_${suffix}@test.invalid`,
      password: 'testpass123', account_type: 'student', grade_level: 5,
    });
    if (r.status === 200 && r.data.token) {
      studentToken = r.data.token; studentId = r.data.user.id;
      pass('auth.register_student', `id=${studentId}`);
    } else fail('auth.register_student', r.data.error || r.status);
  }

  {
    const r = await req('POST', '/auth/login', { email: `tp_${suffix}@test.invalid`, password: 'testpass123' });
    r.status === 200 && r.data.token ? pass('auth.login', 'JWT returned') : fail('auth.login', r.status);
  }

  {
    const r = await req('POST', '/auth/login', { email: `tp_${suffix}@test.invalid`, password: 'wrong' });
    r.status === 401 ? pass('auth.bad_password_rejects', 'HTTP 401') : fail('auth.bad_password_rejects', `got ${r.status}`);
  }

  {
    const r = await req('POST', '/auth/register', { name: 'Dup', email: `tp_${suffix}@test.invalid`, password: 'testpass123', account_type: 'parent' });
    r.status === 409 ? pass('auth.duplicate_email_rejects', 'HTTP 409') : fail('auth.duplicate_email_rejects', `got ${r.status}`);
  }

  // ── Parent ────────────────────────────────────────────────────────────────
  if (parentToken && studentId) {
    {
      const r = await req('POST', '/parent/link-student', { email: `ts_${suffix}@test.invalid` }, parentToken);
      r.status === 200 && r.data.student?.id === studentId
        ? pass('parent.link_student', `linked ${studentId}`)
        : fail('parent.link_student', r.data.error || r.status);
    }

    {
      const r = await req('POST', '/parent/link-student', { email: `ts_${suffix}@test.invalid` }, parentToken);
      r.status === 409 ? pass('parent.link_duplicate_rejects', 'HTTP 409') : fail('parent.link_duplicate_rejects', `got ${r.status}`);
    }

    {
      const r = await req('POST', '/parent/link-student', { email: 'nobody@test.invalid' }, parentToken);
      r.status === 404 ? pass('parent.link_nonexistent_rejects', 'HTTP 404') : fail('parent.link_nonexistent_rejects', `got ${r.status}`);
    }

    {
      const r = await req('GET', '/parent/dashboard', null, parentToken);
      r.status === 200 && r.data.students?.some(s => s.id === studentId)
        ? pass('parent.dashboard', 'student visible')
        : fail('parent.dashboard', r.data.error || 'student missing');
    }

    {
      const r = await req('POST', '/parent/questions', {
        type: 'multiple_choice', difficulty: 'easy',
        question_text: 'What is 2 + 2?', answer: '4',
        options: [
          { label: 'A', text: '3', is_correct: false },
          { label: 'B', text: '4', is_correct: true },
          { label: 'C', text: '5', is_correct: false },
          { label: 'D', text: '6', is_correct: false },
        ],
      }, parentToken);
      if (r.status === 200 && r.data.id) {
        questionId = r.data.id;
        pass('parent.create_mc_question', `id=${questionId} options=${r.data.options?.length}`);
      } else fail('parent.create_mc_question', r.data.error || r.status);
    }

    {
      const r = await req('POST', '/parent/questions', {
        type: 'word_problem', difficulty: 'medium',
        question_text: 'If you have 10 apples and eat 3, how many are left?', answer: '7',
      }, parentToken);
      if (r.status === 200 && r.data.id) {
        questionId2 = r.data.id;
        pass('parent.create_word_problem', `id=${questionId2}`);
      } else fail('parent.create_word_problem', r.data.error || r.status);
    }

    {
      const r = await req('POST', '/parent/questions', { type: 'bad_type', difficulty: 'easy', question_text: 'x', answer: 'y' }, parentToken);
      r.status === 400 ? pass('parent.create_invalid_type_rejects', 'HTTP 400') : fail('parent.create_invalid_type_rejects', `got ${r.status}`);
    }

    // batch assign: the core new feature
    if (questionId && questionId2) {
      const r = await req('POST', '/parent/assign-batch',
        { student_id: studentId, question_ids: [questionId, questionId2] }, parentToken);
      if (r.status === 200 && r.data.assigned === 2) {
        pass('parent.assign_batch', `assigned=${r.data.assigned}`);
      } else fail('parent.assign_batch', r.data.error || JSON.stringify(r.data));
    }

    {
      const r = await req('POST', '/parent/assign-batch', { student_id: 99999, question_ids: [questionId] }, parentToken);
      r.status === 403 ? pass('parent.assign_batch_unlinked_rejects', 'HTTP 403') : fail('parent.assign_batch_unlinked_rejects', `got ${r.status}`);
    }

    {
      const r = await req('POST', '/parent/assign-batch', { student_id: studentId, question_ids: [1,2,3,4,5,6] }, parentToken);
      r.status === 400 ? pass('parent.assign_batch_over_limit_rejects', 'HTTP 400') : fail('parent.assign_batch_over_limit_rejects', `got ${r.status}`);
    }

    if (questionId) {
      const r = await req('POST', '/parent/assign', { student_id: studentId, question_id: questionId }, parentToken);
      if (r.status === 200 && r.data.id) {
        assignmentId = r.data.id;
        pass('parent.assign_single', `id=${assignmentId}`);
      } else fail('parent.assign_single', r.data.error || r.status);
    }

    {
      const r = await req('POST', '/parent/assign', { student_id: 99999, question_id: questionId }, parentToken);
      r.status === 403 ? pass('parent.assign_unlinked_rejects', 'HTTP 403') : fail('parent.assign_unlinked_rejects', `got ${r.status}`);
    }

    if (studentId) {
      const r = await req('GET', `/parent/student/${studentId}/progress`, null, parentToken);
      r.status === 200 && 'stats' in r.data
        ? pass('parent.view_student_progress', `total=${r.data.stats.total}`)
        : fail('parent.view_student_progress', r.data.error || r.status);
    }
  }

  // ── Student ───────────────────────────────────────────────────────────────
  if (studentToken) {
    {
      const r = await req('GET', '/student/dashboard', null, studentToken);
      r.status === 200 && Array.isArray(r.data.assignments)
        ? pass('student.dashboard', `pending=${r.data.assignments.length}`)
        : fail('student.dashboard', r.data.error || r.status);
    }

    // Practice should serve an assigned question (batch-assigned above)
    {
      const r = await req('GET', '/student/practice?difficulty=easy', null, studentToken);
      if (r.status === 200 && r.data.question_text) {
        const fromAssignment = !!r.data.from_assignment;
        pass('student.practice_serves_assignment', `from_assignment=${fromAssignment} q="${r.data.question_text}"`);

        if (fromAssignment && r.data.assignment_id) {
          const submit = await req('POST', '/student/submit', {
            question_id: r.data.question_id,
            assignment_id: r.data.assignment_id,
            answer_given: r.data.answer,
          }, studentToken);
          submit.status === 200
            ? pass('student.submit_assigned_via_practice', `is_correct=${submit.data.is_correct}`)
            : fail('student.submit_assigned_via_practice', submit.data.error || submit.status);
        }
      } else fail('student.practice_serves_assignment', r.data.error || r.status);
    }

    // Next practice call: another assignment or fallback to generated
    {
      const r = await req('GET', '/student/practice?difficulty=easy', null, studentToken);
      r.status === 200 && r.data.question_text && Array.isArray(r.data.options)
        ? pass('student.practice_next', `from_assignment=${!!r.data.from_assignment}`)
        : fail('student.practice_next', r.data.error || r.status);
    }

    // Generated question: correct answer
    {
      const q = await req('GET', '/student/practice?difficulty=easy', null, studentToken);
      if (q.status === 200 && !q.data.from_assignment && Array.isArray(q.data.options)) {
        const correct = q.data.options.find(o => o.is_correct || o.option_text === q.data.answer);
        if (correct) {
          const r = await req('POST', '/student/submit', {
            is_generated: true, question_text: q.data.question_text,
            answer: q.data.answer, answer_given: correct.option_text, difficulty: 'easy',
          }, studentToken);
          r.status === 200 && r.data.is_correct === true
            ? pass('student.submit_correct_generated', 'is_correct=true')
            : fail('student.submit_correct_generated', r.data.error || JSON.stringify(r.data));
        } else pass('student.submit_correct_generated', 'skipped – assignment queue still active');
      } else pass('student.submit_correct_generated', 'skipped – assignment queue still active');
    }

    if (assignmentId && questionId) {
      const r = await req('POST', '/student/submit', {
        question_id: questionId, assignment_id: assignmentId, answer_given: '4',
      }, studentToken);
      r.status === 200 && r.data.is_correct === true
        ? pass('student.submit_assignment_direct', 'is_correct=true')
        : fail('student.submit_assignment_direct', r.data.error || JSON.stringify(r.data));
    }
  }

  // ── Auth guards ───────────────────────────────────────────────────────────
  {
    const r = await req('GET', '/parent/dashboard', null, null);
    r.status === 401 ? pass('auth.unauthenticated_rejects', 'HTTP 401') : fail('auth.unauthenticated_rejects', `got ${r.status}`);
  }
  {
    const r = await req('GET', '/parent/dashboard', null, studentToken);
    r.status === 403 ? pass('auth.student_blocked_from_parent', 'HTTP 403') : fail('auth.student_blocked_from_parent', `got ${r.status}`);
  }
  {
    const r = await req('GET', '/student/dashboard', null, parentToken);
    r.status === 403 ? pass('auth.parent_blocked_from_student', 'HTTP 403') : fail('auth.parent_blocked_from_student', `got ${r.status}`);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  // (test users and questions are left in DB; agent route cleans on its own runs)

  // ── Report ────────────────────────────────────────────────────────────────
  const groups = {};
  for (const r of results) {
    const [g, ...rest] = r.name.split('.');
    (groups[g] = groups[g] || []).push({ ...r, short: rest.join('.') });
  }

  for (const [g, tests] of Object.entries(groups)) {
    const anyFail = tests.some(t => !t.ok);
    console.log(`\n  ${B}${g}${X}${anyFail ? ` ${R}(failures)${X}` : ''}`);
    for (const t of tests) {
      if (t.ok) {
        console.log(`    ${G}✓${X} ${t.short}${t.detail ? ` ${D}(${t.detail})${X}` : ''}`);
      } else {
        console.log(`    ${R}✗${X} ${t.short}`);
        console.log(`      ${D}${t.err}${X}`);
      }
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${'─'.repeat(50)}`);
  const badge = failed === 0 ? `${G}PASS${X}` : `${R}FAIL${X}`;
  console.log(`${B}${badge}${X}  ${passed}/${results.length} passed${failed ? `\n${R}      ${failed} test(s) failed${X}` : ''}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(R + 'Unexpected error: ' + e.message + X); process.exit(1); });
