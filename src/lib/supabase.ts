// supabase.ts — Supabase client for ClassCard
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * A throwaway client used ONLY for creating an account on someone else's
 * behalf (a teacher adding a student, an admin adding a teacher).
 *
 * Supabase's signUp() doesn't just create the account — it signs that new
 * account in on whichever client made the call. Done on the shared `sb`
 * client, that silently swaps the teacher's session for the brand-new
 * student's midway through "Add Student": the page still LOOKS like the
 * teacher is logged in, because that's React state, but every request from
 * then on is made as the student. The insert that follows is then rejected,
 * and unrelated teacher-only queries start failing too.
 *
 * persistSession/autoRefreshToken are off and it gets its own storage key,
 * so nothing it does can reach the real session.
 */
export function createSignUpClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'classcard-signup-scratch',
    },
  });
}

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  student_id?: string;
};

export type Student = {
  id: string;
  name: string;
  teacher_id: string;
  auth_user_id?: string;
  login_email?: string;
  robot_color_index?: number;
  face_pixels?: string;
  must_change_pin?: boolean;
  created_at: string;
};

export type ArenaBattle = {
  id: string;
  week_start: string;      // ISO date of Monday (YYYY-MM-DD)
  winner_student_id: string;
  loser_student_id: string;
  created_at: string;
};

// ── Arena helpers ──────────────────────────────────────────────────────────

/** Returns the Monday of the current week as a YYYY-MM-DD string (local time). */
export function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon…
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Returns the Sunday of the current week as a YYYY-MM-DD string (local time). */
export function getWeekEnd(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Record a win for this week. */
export async function recordArenaWin(winnerStudentId: string, loserStudentId: string) {
  const week_start = getWeekStart();
  const { error } = await sb.from('arena_battles').insert({
    week_start,
    winner_student_id: winnerStudentId,
    loser_student_id: loserStudentId,
  });
  if (error) throw error;
}

/** Check whether playerStudentId has already challenged opponentStudentId this week. */
export async function hasPlayedThisWeek(playerStudentId: string, opponentStudentId: string): Promise<boolean> {
  const week_start = getWeekStart();
  const { data } = await sb
    .from('arena_battles')
    .select('id')
    .eq('week_start', week_start)
    .or(`and(winner_student_id.eq.${playerStudentId},loser_student_id.eq.${opponentStudentId}),and(winner_student_id.eq.${opponentStudentId},loser_student_id.eq.${playerStudentId})`)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Fetch weekly scoreboard: top 5 by win count for the current week. */
export async function getWeeklyScoreboard(teacherId?: string): Promise<{ student_id: string; name: string; wins: number }[]> {
  const week_start = getWeekStart();
  // Fetch all battles this week
  const { data, error } = await sb
    .from('arena_battles')
    .select('winner_student_id')
    .eq('week_start', week_start);
  if (error) throw error;

  // Count wins per student
  const counts: Record<string, number> = {};
  for (const row of (data || [])) {
    counts[row.winner_student_id] = (counts[row.winner_student_id] || 0) + 1;
  }

  if (Object.keys(counts).length === 0) return [];

  // Fetch student names
  const ids = Object.keys(counts);
  let query = sb.from('students').select('id, name, teacher_id').in('id', ids);
  if (teacherId) query = query.eq('teacher_id', teacherId);
  const { data: students } = await query;

  const board = (students || []).map((s: any) => ({
    student_id: s.id,
    name: s.name,
    wins: counts[s.id] || 0,
  }));
  board.sort((a, b) => b.wins - a.wins);
  return board.slice(0, 5);
}

/** Get gold/silver/bronze finish counts for a student across all weeks. */
export async function getMedalCounts(studentId: string, teacherId?: string): Promise<{ gold: number; silver: number; bronze: number }> {
  // Fetch ALL battles in one query
  const { data: allBattles } = await sb
    .from('arena_battles')
    .select('week_start, winner_student_id');

  // Fetch ALL students in one query
  let stuQuery = sb.from('students').select('id');
  if (teacherId) stuQuery = stuQuery.eq('teacher_id', teacherId);
  const { data: stuRows } = await stuQuery;
  const allIds = (stuRows || []).map((s: any) => s.id);

  // Group battles by week — all in JS, no more queries
  const byWeek: Record<string, Record<string, number>> = {};
  for (const row of (allBattles || [])) {
    if (!byWeek[row.week_start]) byWeek[row.week_start] = {};
    byWeek[row.week_start][row.winner_student_id] =
      (byWeek[row.week_start][row.winner_student_id] || 0) + 1;
  }

  // Count medals across all weeks
  let gold = 0, silver = 0, bronze = 0;

  for (const counts of Object.values(byWeek)) {
    const ranked = allIds
      .map((id: string) => ({ id, wins: counts[id] || 0 }))
      .filter((s: any) => s.wins > 0)
      .sort((a: any, b: any) => b.wins - a.wins);

    if (ranked[0]?.id === studentId) gold++;
    else if (ranked[1]?.id === studentId) silver++;
    else if (ranked[2]?.id === studentId) bronze++;
  }

  return { gold, silver, bronze };
}

export type Card = {
  id: string;
  student_id: string;
  teacher_id: string;
  rarity: 'common' | 'silver' | 'gold-rare' | 'prismatic';
  card_name: string;
  hp: number;
  type: string;
  description: string;
  stat1_name: string;
  stat1_val: number;
  stat2_name: string;
  stat2_val: number;
  stat3_name: string;
  stat3_val: number;
  move1_name: string;
  move1_dmg: number;
  move2_name: string;
  move2_dmg: number;
  image_url: string;
  card_source?: 'generated' | 'built';
  created_at: string;
  students?: { name: string };
};

// ── Robot Customization helpers ────────────────────────────────────────────

/** Save student's robot color and face pixels to database */
export async function saveStudentRobotSettings(
  studentId: string,
  colorIndex: number,
  facePixels: string[] | null,
  botElements?: any[] | null
): Promise<void> {
  const update: Record<string, any> = {
    robot_color_index: colorIndex,
    face_pixels: facePixels ? JSON.stringify(facePixels) : null,
  };
  if (botElements !== undefined) {
    update.bot_elements = botElements ? JSON.stringify(botElements) : null;
  }
  const { error } = await sb.from('students').update(update).eq('id', studentId);
  if (error) throw error;
}

/** Load student's robot settings from database */
export async function loadStudentRobotSettings(
  studentId: string
): Promise<{ colorIndex: number; facePixels: string[] | null; botElements: any[] | null } | null> {
  const { data, error } = await sb
    .from('students')
    .select('robot_color_index, face_pixels, bot_elements')
    .eq('id', studentId)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) return null;
  
  return {
    colorIndex: data.robot_color_index ?? 0,
    facePixels: data.face_pixels ? JSON.parse(data.face_pixels) : null,
    botElements: data.bot_elements ? JSON.parse(data.bot_elements) : null,
  };
}

// ── 3D Aura helpers ─────────────────────────────────────────────────────────
// 3D Aura itself (public/3daura) talks to Supabase directly as a plain static
// page sharing the same session, since its save data (world/build grids) can
// get large and doesn't need to round-trip through this React app. These
// helpers are for the two things the *teacher* controls from here: resetting
// a student's build (keeping their money/inventory/pets), and the one set of
// world settings that applies to every student under that teacher.

export type Aura3dTeacherSettings = {
  dayNightEnabled?: boolean;
  dayNightSpeed?: number;
  fogFar?: number;
  petGapDog?: number;
  petGapCat?: number;
  petGapBird?: number;
  petGapAlpaca?: number;
  petGapBunny?: number;
  petGapFrog?: number;
  petGapMonkey?: number;
  petGapPanda?: number;
  petGapOwl?: number;
  petGapDragon?: number;
  petGapLamb?: number;
};

export const AURA3D_SETTINGS_DEFAULTS: Required<Aura3dTeacherSettings> = {
  dayNightEnabled: true,
  dayNightSpeed: 1,
  fogFar: 240,
  petGapDog: 6.8,
  petGapCat: 4.4,
  petGapBird: 4,
  petGapAlpaca: 4,
  petGapBunny: 3.2,
  petGapFrog: 2.6,
  petGapMonkey: 2,
  petGapPanda: 3,
  petGapOwl: 5,
  petGapDragon: 4.6,
  petGapLamb: 3.6,
};

/**
 * Resets a student's 3D Aura BUILD only (everything they've placed/built in
 * the world) while leaving their wallet (money, inventory, pets) untouched.
 * This is the "Reset Build/AuraBot" action from the Teacher page.
 *
 * If the student is in a shared team world, the build that actually needs
 * clearing lives on the shared world row, not on their own — resetting only
 * their own row would silently do nothing. Returns whether a shared world was
 * cleared so the Teacher page can warn that this affected the whole team.
 */
export async function resetStudentAura3dBuild(studentId: string): Promise<{ sharedWorld: boolean }> {
  const emptyBuild = { worldGrid: [], buildGrid: [] };

  // aura3d_world_id only exists once the shared-worlds migration has been run,
  // so a failure here just means "no team worlds yet" — fall through to the
  // original personal-world behaviour rather than breaking the button.
  let worldId: string | null = null;
  try {
    const { data } = await sb.from('students').select('aura3d_world_id').eq('id', studentId).maybeSingle();
    worldId = (data as { aura3d_world_id?: string | null } | null)?.aura3d_world_id ?? null;
  } catch {
    worldId = null;
  }

  if (worldId) {
    const { error } = await sb
      .from('aura3d_worlds')
      .update({ build: emptyBuild, updated_at: new Date().toISOString() })
      .eq('id', worldId);
    if (error) throw error;
    return { sharedWorld: true };
  }

  const { error } = await sb
    .from('students')
    .update({ aura3d_build: emptyBuild, aura3d_saved_at: new Date().toISOString() })
    .eq('id', studentId);
  if (error) throw error;
  return { sharedWorld: false };
}

/** Loads the current teacher's universal 3D Aura settings (or defaults if none saved yet). */
export async function loadAura3dTeacherSettings(teacherId: string): Promise<Aura3dTeacherSettings> {
  const { data, error } = await sb
    .from('aura3d_teacher_settings')
    .select('settings')
    .eq('teacher_id', teacherId)
    .maybeSingle();
  if (error) {
    // Table may not exist yet if the migration hasn't been run - degrade to
    // defaults rather than breaking the Teacher page.
    console.error('Could not load 3D Aura settings (has the migration been run?):', error);
    return { ...AURA3D_SETTINGS_DEFAULTS };
  }
  return { ...AURA3D_SETTINGS_DEFAULTS, ...(data?.settings ?? {}) };
}

/** Saves the teacher's universal 3D Aura settings - every student under them picks these up next load. */
export async function saveAura3dTeacherSettings(teacherId: string, settings: Aura3dTeacherSettings): Promise<void> {
  const { error } = await sb
    .from('aura3d_teacher_settings')
    .upsert({ teacher_id: teacherId, settings, updated_at: new Date().toISOString() }, { onConflict: 'teacher_id' });
  if (error) throw error;
}


/* ─────────────────────────────────────────────────────────────
   3D AURA — TEACHER-EDITABLE KIOSK QUIZ BANKS

   Four fixed slots in the kiosk. A teacher can replace any of them with
   their own topic and 10 questions; a slot with no saved row simply falls
   back to the built-in questions in public/3daura/quiz-questions.js, which
   is also all "Restore Default" does (it deletes the row).
───────────────────────────────────────────────────────────── */

export type Aura3dQuestion = {
  /** The question text. */
  q: string;
  /** Exactly four answer options. */
  o: string[];
  /** Zero-based index into `o` of the correct answer. */
  a: number;
};

export type Aura3dBankKey = 'landmark' | 'words' | 'people' | 'art';

export const AURA3D_BANK_KEYS: Aura3dBankKey[] = ['landmark', 'words', 'people', 'art'];

export type Aura3dQuestionBank = {
  title: string;
  questions: Aura3dQuestion[];
};

/**
 * Validates a question bank before it's saved or used. Anything malformed is
 * rejected here rather than being allowed to crash the quiz mid-lesson, and
 * the returned message is written for a teacher, not a developer.
 */
export function validateAura3dQuestions(
  questions: unknown,
  { requireTen = true }: { requireTen?: boolean } = {}
): { ok: true; questions: Aura3dQuestion[] } | { ok: false; error: string } {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, error: 'No questions found.' };
  }
  if (requireTen && questions.length !== 10) {
    return { ok: false, error: `Found ${questions.length} question${questions.length === 1 ? '' : 's'} — each quiz needs exactly 10.` };
  }
  for (let i = 0; i < questions.length; i++) {
    const item = questions[i] as Aura3dQuestion;
    const at = `Question ${i + 1}`;
    if (!item || typeof item !== 'object') return { ok: false, error: `${at} is not formatted correctly.` };
    if (typeof item.q !== 'string' || !item.q.trim()) return { ok: false, error: `${at} has no question text.` };
    if (!Array.isArray(item.o) || item.o.length !== 4) return { ok: false, error: `${at} needs exactly 4 answer options.` };
    if (item.o.some(o => typeof o !== 'string' || !o.trim())) return { ok: false, error: `${at} has a blank answer option.` };
    if (!Number.isInteger(item.a) || item.a < 0 || item.a > 3) return { ok: false, error: `${at} doesn't say which answer is correct.` };
  }
  return {
    ok: true,
    questions: (questions as Aura3dQuestion[]).map(item => ({
      q: item.q.trim(),
      o: item.o.map(o => o.trim()),
      a: item.a,
    })),
  };
}

/**
 * Loads the built-in question banks straight from the game's own
 * quiz-questions.js, so the Teacher page and the students always see exactly
 * the same defaults and there's no second copy to keep in sync. The file is
 * injected as a plain <script> once and cached on window.
 */
export async function loadAura3dDefaultBanks(): Promise<Record<Aura3dBankKey, Aura3dQuestionBank>> {
  const w = window as unknown as { AURA3D_DEFAULT_QUESTION_BANKS?: Record<Aura3dBankKey, Aura3dQuestionBank> };
  if (w.AURA3D_DEFAULT_QUESTION_BANKS) return w.AURA3D_DEFAULT_QUESTION_BANKS;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-aura3d-defaults]');
    if (existing) { existing.addEventListener('load', () => resolve()); existing.addEventListener('error', () => reject(new Error('load failed'))); return; }
    const el = document.createElement('script');
    el.src = '/3daura/quiz-questions.js';
    el.dataset.aura3dDefaults = 'true';
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Could not load the default questions.'));
    document.head.appendChild(el);
  });

  if (!w.AURA3D_DEFAULT_QUESTION_BANKS) throw new Error('Could not read the default questions.');
  return w.AURA3D_DEFAULT_QUESTION_BANKS;
}

/** Loads whichever banks this teacher has customised. Missing keys mean "still using the defaults". */
export async function loadAura3dQuestionBanks(
  teacherId: string
): Promise<Partial<Record<Aura3dBankKey, Aura3dQuestionBank>>> {
  const { data, error } = await sb
    .from('aura3d_question_banks')
    .select('bank_key, title, questions')
    .eq('teacher_id', teacherId);
  if (error) {
    // Table may not exist yet if the migration hasn't been run - degrade to
    // "no overrides" rather than breaking the Teacher page.
    console.error('Could not load 3D Aura question banks (has the migration been run?):', error);
    return {};
  }
  const out: Partial<Record<Aura3dBankKey, Aura3dQuestionBank>> = {};
  (data ?? []).forEach(row => {
    out[row.bank_key as Aura3dBankKey] = { title: row.title ?? '', questions: row.questions ?? [] };
  });
  return out;
}

/** Replaces one kiosk quiz slot with the teacher's own topic and questions. */
export async function saveAura3dQuestionBank(
  teacherId: string,
  bankKey: Aura3dBankKey,
  bank: Aura3dQuestionBank
): Promise<void> {
  const check = validateAura3dQuestions(bank.questions);
  if (!check.ok) throw new Error(check.error);
  if (!bank.title.trim()) throw new Error('Give the quiz a title first.');

  const { error } = await sb
    .from('aura3d_question_banks')
    .upsert(
      {
        teacher_id: teacherId,
        bank_key: bankKey,
        title: bank.title.trim(),
        questions: check.questions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'teacher_id,bank_key' }
    );
  if (error) throw error;
}

/** Puts one slot back to the built-in questions by removing the teacher's override. */
export async function resetAura3dQuestionBank(teacherId: string, bankKey: Aura3dBankKey): Promise<void> {
  const { error } = await sb
    .from('aura3d_question_banks')
    .delete()
    .eq('teacher_id', teacherId)
    .eq('bank_key', bankKey);
  if (error) throw error;
}

/**
 * Builds the prompt a teacher copies into Claude. Deliberately asks for a
 * fenced JSON block in exactly the shape parseAura3dQuestionsFromText()
 * accepts, so the reply can be pasted straight back in without editing.
 */
export function buildAura3dClaudePrompt(title: string, ageLevel: string): string {
  const topic = title.trim() || '[your topic]';
  const age = ageLevel.trim() || '[year level or age]';
  return `Write 10 multiple-choice quiz questions about "${topic}" for students at this level: ${age}.

Rules:
- Exactly 10 questions.
- Each question has exactly 4 answer options, and exactly one is correct.
- Keep the reading level appropriate for ${age}, and keep every question school-appropriate.
- Make the three wrong options plausible, not silly.
- Don't number the questions inside the question text.

Reply with ONLY a JSON array in a code block, in exactly this format, where "a" is the 0-based position of the correct option in "o":

\`\`\`json
[
  { "q": "Question text here?", "o": ["Option A", "Option B", "Option C", "Option D"], "a": 0 }
]
\`\`\``;
}

/**
 * Parses whatever the teacher pastes back from Claude. Tolerant on purpose:
 * accepts the raw JSON array, a ```json fenced block, or the array buried in
 * surrounding chat text, because teachers will paste all three.
 */
export function parseAura3dQuestionsFromText(
  text: string
): { ok: true; questions: Aura3dQuestion[] } | { ok: false; error: string } {
  const raw = (text ?? '').trim();
  if (!raw) return { ok: false, error: 'Paste Claude’s answer into the box first.' };

  const candidates: string[] = [];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1]);
  const bracketed = raw.match(/\[[\s\S]*\]/);
  if (bracketed) candidates.push(bracketed[0]);
  candidates.push(raw);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim());
      const check = validateAura3dQuestions(parsed);
      if (check.ok) return check;
      return { ok: false, error: check.error };
    } catch {
      // Try the next candidate shape.
    }
  }
  return { ok: false, error: 'That doesn’t look like the JSON list Claude was asked for. Copy the whole code block from Claude’s reply and paste it again.' };
}
