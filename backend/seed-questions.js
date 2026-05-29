require('dotenv').config();
const BASE = `http://localhost:${process.env.PORT || 3000}`;

async function req(method, path, body, token) {
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

const QUESTIONS = [
  {
    type: 'multiple_choice', difficulty: 'easy',
    question_text: 'What is 15 + 28?',
    answer: '43',
    options: [
      { label: 'A', text: '41', is_correct: false },
      { label: 'B', text: '43', is_correct: true },
      { label: 'C', text: '45', is_correct: false },
      { label: 'D', text: '53', is_correct: false },
    ],
  },
  {
    type: 'multiple_choice', difficulty: 'easy',
    question_text: 'What is 9 × 7?',
    answer: '63',
    options: [
      { label: 'A', text: '56', is_correct: false },
      { label: 'B', text: '62', is_correct: false },
      { label: 'C', text: '63', is_correct: true },
      { label: 'D', text: '72', is_correct: false },
    ],
  },
  {
    type: 'word_problem', difficulty: 'easy',
    question_text: 'A bag has 5 red marbles and 8 blue marbles. How many marbles are in the bag altogether?',
    answer: '13',
  },
  {
    type: 'multiple_choice', difficulty: 'easy',
    question_text: 'Which of these fractions is equivalent to 1/2?',
    answer: '4/8',
    options: [
      { label: 'A', text: '2/3', is_correct: false },
      { label: 'B', text: '3/5', is_correct: false },
      { label: 'C', text: '4/8', is_correct: true },
      { label: 'D', text: '5/9', is_correct: false },
    ],
  },
  {
    type: 'word_problem', difficulty: 'medium',
    question_text: 'A train travels at 80 km/h for 2.5 hours. How many kilometres does it travel?',
    answer: '200',
  },
  {
    type: 'multiple_choice', difficulty: 'medium',
    question_text: 'What is 25% of 160?',
    answer: '40',
    options: [
      { label: 'A', text: '25', is_correct: false },
      { label: 'B', text: '40', is_correct: true },
      { label: 'C', text: '45', is_correct: false },
      { label: 'D', text: '64', is_correct: false },
    ],
  },
  {
    type: 'multiple_choice', difficulty: 'medium',
    question_text: 'What is the perimeter of a square with a side length of 7 cm?',
    answer: '28 cm',
    options: [
      { label: 'A', text: '14 cm', is_correct: false },
      { label: 'B', text: '21 cm', is_correct: false },
      { label: 'C', text: '28 cm', is_correct: true },
      { label: 'D', text: '49 cm', is_correct: false },
    ],
  },
  {
    type: 'word_problem', difficulty: 'medium',
    question_text: 'A bookshelf has 6 shelves and each shelf holds 14 books. If 23 books have been removed, how many books are left?',
    answer: '61',
  },
  {
    type: 'multiple_choice', difficulty: 'medium',
    question_text: 'What is the value of 3² + 4²?',
    answer: '25',
    options: [
      { label: 'A', text: '14', is_correct: false },
      { label: 'B', text: '25', is_correct: true },
      { label: 'C', text: '49', is_correct: false },
      { label: 'D', text: '50', is_correct: false },
    ],
  },
  {
    type: 'word_problem', difficulty: 'hard',
    question_text: 'A shop sells pencils for 35 cents each or 3 for $1.00. What is the cheapest way to buy exactly 10 pencils, and how much does it cost?',
    answer: '$3.35',
  },
  {
    type: 'multiple_choice', difficulty: 'hard',
    question_text: 'If 5x + 3 = 2x + 18, what is the value of x?',
    answer: '5',
    options: [
      { label: 'A', text: '3', is_correct: false },
      { label: 'B', text: '5', is_correct: true },
      { label: 'C', text: '7', is_correct: false },
      { label: 'D', text: '15', is_correct: false },
    ],
  },
  {
    type: 'multiple_choice', difficulty: 'hard',
    question_text: 'What is the area of a triangle with base 12 cm and height 9 cm?',
    answer: '54 cm²',
    options: [
      { label: 'A', text: '42 cm²', is_correct: false },
      { label: 'B', text: '54 cm²', is_correct: true },
      { label: 'C', text: '108 cm²', is_correct: false },
      { label: 'D', text: '216 cm²', is_correct: false },
    ],
  },
  {
    type: 'word_problem', difficulty: 'hard',
    question_text: 'The ratio of boys to girls in a class is 3:5. If there are 40 students in total, how many are boys?',
    answer: '15',
  },
];

async function main() {
  const ts = Date.now();
  let parentToken, studentToken, parentId, studentId;

  // ── Register parent ────────────────────────────────────────────────────────
  {
    const r = await req('POST', '/auth/register', {
      name: 'Demo Parent',
      email: `demo_parent_${ts}@seed.invalid`,
      password: 'seedpass99',
      account_type: 'parent',
    });
    if (r.status !== 200) { console.error('Register parent failed:', r.data); process.exit(1); }
    parentToken = r.data.token;
    parentId = r.data.user.id;
    console.log(`✅ Parent registered (id=${parentId})`);
  }

  // ── Register student ───────────────────────────────────────────────────────
  {
    const r = await req('POST', '/auth/register', {
      name: 'Demo Student',
      email: `demo_student_${ts}@seed.invalid`,
      password: 'seedpass99',
      account_type: 'student',
      grade_level: 6,
    });
    if (r.status !== 200) { console.error('Register student failed:', r.data); process.exit(1); }
    studentToken = r.data.token;
    studentId = r.data.user.id;
    console.log(`✅ Student registered (id=${studentId})`);
  }

  // ── Link ───────────────────────────────────────────────────────────────────
  {
    const r = await req('POST', '/parent/link-student',
      { email: `demo_student_${ts}@seed.invalid` }, parentToken);
    if (r.status !== 200) { console.error('Link failed:', r.data); process.exit(1); }
    console.log(`✅ Student linked to parent`);
  }

  // ── Create questions ───────────────────────────────────────────────────────
  const createdIds = [];
  for (const q of QUESTIONS) {
    const r = await req('POST', '/parent/questions', q, parentToken);
    if (r.status !== 200) { console.error('Create question failed:', r.data); continue; }
    createdIds.push(r.data.id);
    console.log(`  ➕ ${q.difficulty.padEnd(6)} ${q.type.padEnd(15)} — ${q.question_text.slice(0, 55)}`);
  }
  console.log(`\n✅ Created ${createdIds.length} questions`);

  // ── Batch assign first 5 ──────────────────────────────────────────────────
  const batch1 = createdIds.slice(0, 5);
  {
    const r = await req('POST', '/parent/assign-batch',
      { student_id: studentId, question_ids: batch1 }, parentToken);
    if (r.status !== 200) { console.error('Batch assign failed:', r.data); process.exit(1); }
    console.log(`\n✅ Assigned first 5 questions as a practice set (${r.data.assigned} assigned)`);
  }

  // ── Student dashboard — confirm pending ───────────────────────────────────
  {
    const r = await req('GET', '/student/dashboard', null, studentToken);
    console.log(`✅ Student sees ${r.data.assignments.length} pending assignments`);
  }

  // ── Student answers all 5 ─────────────────────────────────────────────────
  console.log('\n── Student answering assigned questions ──');
  let correct = 0;
  for (let i = 0; i < 5; i++) {
    const practice = await req('GET', '/student/practice?difficulty=easy', null, studentToken);
    if (!practice.data.from_assignment) {
      console.log(`  Q${i+1}: no more assignments in queue`);
      break;
    }
    const q = practice.data;
    // Use the correct answer
    const answer = q.answer;
    const submit = await req('POST', '/student/submit', {
      question_id: q.question_id,
      assignment_id: q.assignment_id,
      answer_given: answer,
    }, studentToken);
    if (submit.data.is_correct) {
      correct++;
      console.log(`  ✅ Q${i+1} correct — "${q.question_text.slice(0, 45)}"`);
    } else {
      console.log(`  ❌ Q${i+1} wrong — expected ${answer}, got ${submit.data.correct_answer}`);
    }
  }

  // ── Final stats ────────────────────────────────────────────────────────────
  const progress = await req('GET', `/parent/student/${studentId}/progress`, null, parentToken);
  const { stats } = progress.data;
  console.log(`\n── Parent sees student stats ──`);
  console.log(`   Attempts: ${stats.total}, Correct: ${stats.correct}, Accuracy: ${Math.round(stats.correct/stats.total*100)}%`);

  // ── Assign remaining questions one at a time (testing single assign) ──────
  console.log('\n── Assigning remaining questions individually ──');
  for (const qid of createdIds.slice(5)) {
    const r = await req('POST', '/parent/assign', { student_id: studentId, question_id: qid }, parentToken);
    if (r.status === 200) process.stdout.write('.');
    else console.log(`\nFailed: ${r.data.error}`);
  }
  console.log(`\n✅ Assigned ${createdIds.length - 5} more questions individually`);

  // ── Final student dashboard ────────────────────────────────────────────────
  const dash = await req('GET', '/student/dashboard', null, studentToken);
  console.log(`✅ Student now has ${dash.data.assignments.length} pending assignments in total`);

  console.log('\n🎉 Seed complete!');
  console.log(`   Parent email: demo_parent_${ts}@seed.invalid  (password: seedpass99)`);
  console.log(`   Student email: demo_student_${ts}@seed.invalid  (password: seedpass99)`);
}

main().catch(console.error);
