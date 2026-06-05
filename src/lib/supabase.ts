// supabase.ts — Supabase client for ClassCard
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

