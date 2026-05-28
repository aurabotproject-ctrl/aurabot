// dashboard.ts — Data helpers for students & cards
import { sb } from './supabase';
import type { Student, Card } from './supabase';

export const Dashboard = {
  // Students
  async createStudent(name: string, teacherId: string, authUserId?: string, loginEmail?: string): Promise<Student> {
    const { data, error } = await sb.from('students')
      .insert({ name, teacher_id: teacherId, auth_user_id: authUserId ?? null, login_email: loginEmail ?? null })
      .select().single();
    if (error) throw error;
    // Link the profile back to this student row.
    // Supabase auth triggers can be slightly delayed, so retry a few times
    // before giving up — the student row is already saved either way.
    if (authUserId) {
      let linked = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 600));
        const { error: profErr } = await sb.from('profiles')
          .update({ student_id: data.id })
          .eq('id', authUserId);
        if (!profErr) { linked = true; break; }
      }
      // Non-fatal if profile row isn't ready yet — teacher can reset if needed
      if (!linked) console.warn('Could not link profile for', authUserId, '— profile row may not exist yet');
    }
    return data as Student;
  },

  async getMyStudents(teacherId: string): Promise<Student[]> {
    const { data, error } = await sb.from('students').select('*').eq('teacher_id', teacherId).order('name');
    if (error) throw error;
    return (data || []) as Student[];
  },

  async getAllStudents(): Promise<Student[]> {
    const { data, error } = await sb.from('students').select('*').order('name');
    if (error) throw error;
    return (data || []) as Student[];
  },

  async getAllProfiles() {
    const { data, error } = await sb.from('profiles').select('*').order('role');
    if (error) throw error;
    return data || [];
  },

  // Cards
  async saveCard(cardObj: Omit<Card, 'id' | 'created_at'>): Promise<Card> {
    const { data, error } = await sb.from('cards').insert(cardObj).select().single();
    if (error) throw error;
    return data as Card;
  },

  async getMyCards(teacherId: string): Promise<Card[]> {
    const { data, error } = await sb.from('cards').select('*, students(name)').eq('teacher_id', teacherId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Card[];
  },

  async getStudentCards(studentId: string): Promise<Card[]> {
    const { data, error } = await sb.from('cards').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Card[];
  },

  async getAllCards(): Promise<Card[]> {
    const { data, error } = await sb.from('cards').select('*, students(name)').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Card[];
  },

  async updateCard(id: string, updates: Partial<Card>) {
    const { error } = await sb.from('cards').update(updates).eq('id', id);
    if (error) throw error;
  },

  async deleteCard(id: string) {
    const { error } = await sb.from('cards').delete().eq('id', id);
    if (error) throw error;
  },

  async deleteStudent(id: string) {
    await sb.from('cards').delete().eq('student_id', id);
    const { error } = await sb.from('students').delete().eq('id', id);
    if (error) throw error;
  },

  // Welcome card — the special Aura-Bot founder card given to every new student
  WELCOME_CARD_NAME: 'Aura-Bot 740',

  async hasWelcomeCard(studentId: string): Promise<boolean> {
    const { data } = await sb.from('cards')
      .select('id').eq('student_id', studentId).eq('card_name', 'Aura-Bot 740').maybeSingle();
    return !!data;
  },

  async giveWelcomeCard(studentId: string, teacherId: string): Promise<Card | null> {
    // Idempotent — never duplicate
    if (await Dashboard.hasWelcomeCard(studentId)) return null;
    const card: Omit<Card, 'id' | 'created_at'> = {
      student_id:  studentId,
      teacher_id:  teacherId,
      rarity:      'prismatic',
      card_name:   'Aura-Bot 740',
      hp:          60,
      type:        'Scholar',
      description: 'First to arrive, first to shine. Welcome to ClassCard — your journey begins!',
      stat1_name:  'Charm',   stat1_val: 95,
      stat2_name:  'Smarts',  stat2_val: 88,
      stat3_name:  'Spark',   stat3_val: 100,
      move1_name:  'Welcome Beam',  move1_dmg: 40,
      move2_name:  'Kindness Wave', move2_dmg: 55,
      // Inline SVG data-URI so the card works without an external image host
      image_url: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg width="150" height="148" viewBox="0 0 150 148" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="gB" cx="35%" cy="25%" r="70%"><stop offset="0%" stop-color="#f9ccd6"/><stop offset="100%" stop-color="#e08898"/></radialGradient><radialGradient id="gD" cx="35%" cy="25%" r="70%"><stop offset="0%" stop-color="#e89098"/><stop offset="100%" stop-color="#c87080"/></radialGradient><radialGradient id="gE" cx="30%" cy="28%" r="65%"><stop offset="0%" stop-color="#d4f0ff"/><stop offset="100%" stop-color="#6ecced"/></radialGradient></defs><circle cx="23" cy="85" r="10" fill="url(#gD)"/><rect x="14" y="88" width="18" height="36" rx="9" fill="url(#gD)"/><circle cx="127" cy="85" r="10" fill="url(#gD)"/><rect x="118" y="88" width="18" height="36" rx="9" fill="url(#gD)"/><rect x="25" y="4" width="100" height="72" rx="20" fill="url(#gB)"/><ellipse cx="75" cy="12" rx="32" ry="6" fill="rgba(255,255,255,0.28)"/><rect x="18" y="26" width="9" height="22" rx="4.5" fill="url(#gD)"/><rect x="123" y="26" width="9" height="22" rx="4.5" fill="url(#gD)"/><rect x="31" y="14" width="88" height="50" rx="11" fill="#0d1117"/><ellipse cx="54" cy="39" rx="13" ry="17" fill="url(#gE)"/><ellipse cx="51" cy="33" rx="5" ry="6" fill="rgba(255,255,255,0.55)"/><ellipse cx="96" cy="39" rx="13" ry="17" fill="url(#gE)"/><ellipse cx="93" cy="33" rx="5" ry="6" fill="rgba(255,255,255,0.55)"/><rect x="60" y="76" width="30" height="12" rx="6" fill="url(#gD)"/><rect x="30" y="85" width="90" height="54" rx="20" fill="url(#gB)"/><ellipse cx="75" cy="92" rx="32" ry="6" fill="rgba(255,255,255,0.22)"/><rect x="46" y="96" width="58" height="36" rx="9" fill="#0d1117"/><text x="75" y="112" text-anchor="middle" font-size="8.5" font-weight="900" fill="#a8e6ff" font-family="monospace">Aura-Bot</text><text x="75" y="124" text-anchor="middle" font-size="6.5" fill="rgba(168,230,255,0.55)" font-family="monospace">WELCOME</text><rect x="36" y="136" width="30" height="30" rx="12" fill="url(#gD)"/><rect x="84" y="136" width="30" height="30" rx="12" fill="url(#gD)"/><rect x="30" y="160" width="40" height="14" rx="8" fill="url(#gB)"/><rect x="80" y="160" width="40" height="14" rx="8" fill="url(#gB)"/></svg>`)}`,
      card_source: 'generated',
    };
    return await Dashboard.saveCard(card);
  },

  // Grant the welcome card to every student who doesn't have one yet.
  // Returns the count of cards newly created.
  async giveWelcomeCardToAll(): Promise<number> {
    const allStudents = await Dashboard.getAllStudents();
    // We need a teacher_id — use the first teacher found for each student,
    // falling back to a placeholder that keeps the FK happy.
    let granted = 0;
    for (const student of allStudents) {
      const alreadyHas = await Dashboard.hasWelcomeCard(student.id);
      if (!alreadyHas) {
        await Dashboard.giveWelcomeCard(student.id, student.teacher_id);
        granted++;
      }
    }
    return granted;
  },
};

export function escHtml(str: string): string {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
