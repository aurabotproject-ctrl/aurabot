// auth.ts — Authentication & session helpers
import { sb } from './supabase';
import type { Profile } from './supabase';

export type Session = {
  user: { id: string; email: string };
  profile: Profile;
};

export const Auth = {
  async signIn(email: string, password: string) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },

  async signUp(email: string, password: string, role: string, name: string) {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { role, name } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Sign-up failed');
    return data.user;
  },

  async signOut() {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  },

  async getUser() {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  },

  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data as Profile;
  },

  async getSession(): Promise<Session | null> {
    const user = await this.getUser();
    if (!user) return null;
    const profile = await this.getProfile(user.id);
    return { user: { id: user.id, email: user.email || '' }, profile };
  },

  redirectByRole(role: string) {
    const map: Record<string, string> = {
      admin: '/admin',
      teacher: '/teacher',
      student: '/student',
    };
    const target = map[role];
    if (target) {
      window.location.hash = target;
    }
  },

  async requireAuth(expectedRole?: string): Promise<Session | null> {
    const session = await this.getSession();
    if (!session) {
      window.location.hash = '/';
      return null;
    }
    if (expectedRole && session.profile.role !== expectedRole && session.profile.role !== 'admin') {
      window.location.hash = '/';
      return null;
    }
    return session;
  },
};
