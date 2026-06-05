import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import TeacherPage from './pages/TeacherPage';
import StudentPage from './pages/StudentPage';
import AdminPage from './pages/AdminPage';
import ArenaPage from './pages/ArenaPage';
import BuildABotPage from './pages/BuildABotPage';
import MyCardsPage from './pages/MyCardsPage';
import ShopPage from './pages/ShopPage';
import { Auth } from './lib/auth';
import { Router } from './lib/router';
import type { Session } from './lib/auth';

type Page = 'login' | 'teacher' | 'student' | 'admin' | 'arena' | 'buildabot' | 'mycards' | 'shop';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>('login');

  useEffect(() => {
    init();
    window.addEventListener('hashchange', init);
    return () => window.removeEventListener('hashchange', init);
  }, []);

  async function init() {
    setLoading(true);
    const path = Router.getPath();
    try {
      const s = await Auth.getSession();
      setSession(s);
      if (!s) {
        if (path !== '/') Router.replace('/');
        setPage('login');
      } else {
        const role = s.profile.role;
        if (path === '/' || path === '/login') {
          const rmap: Record<string, Page> = { admin: 'admin', teacher: 'teacher', student: 'student' };
          const target = rmap[role] || 'login';
          Router.navigate('/' + target);
          setPage(target);
        } else if (path.startsWith('/teacher')) {
          if (role !== 'teacher' && role !== 'admin') { Router.navigate('/'); setPage('login'); }
          else setPage('teacher');
        } else if (path.startsWith('/student')) {
          if (role !== 'student' && role !== 'admin') { Router.navigate('/'); setPage('login'); }
          else setPage('student');
        } else if (path.startsWith('/admin')) {
          if (role !== 'admin') { Router.navigate('/'); setPage('login'); }
          else setPage('admin');
        } else if (path.startsWith('/arena')) {
          if (role !== 'student' && role !== 'admin') { Router.navigate('/'); setPage('login'); }
          else setPage('arena');
        } else if (path.startsWith('/buildabot')) {
          if (role !== 'student' && role !== 'admin') { Router.navigate('/'); setPage('login'); }
          else setPage('buildabot');
        } else if (path.startsWith('/mycards')) {
          if (role !== 'student' && role !== 'admin') { Router.navigate('/'); setPage('login'); }
          else setPage('mycards');
        } else if (path.startsWith('/shop')) {
          if (role !== 'student' && role !== 'admin') { Router.navigate('/'); setPage('login'); }
          else setPage('shop');
        } else {
          setPage('login');
        }
      }
    } catch {
      setPage('login');
    }
    setLoading(false);
  }

  const handleSignOut = async () => {
    await Auth.signOut();
    Router.navigate('/');
    window.location.reload();
  };

  const goTo = (p: Page, route: string) => {
    Router.navigate(route);
    setPage(p);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f1629' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      {page === 'login'    && <LoginPage />}
      {page === 'teacher'  && <TeacherPage session={session!} onSignOut={handleSignOut} />}
      {page === 'student'  && <StudentPage session={session!} onSignOut={handleSignOut} />}
      {page === 'admin'    && <AdminPage session={session!} onSignOut={handleSignOut} />}
      {page === 'arena'    && <ArenaPage session={session!} />}
      {page === 'buildabot' && <BuildABotPage onBack={() => goTo('student', '/student')} userId={session?.user.id ?? ''} />}
      {page === 'mycards'  && <MyCardsPage session={session!} onBack={() => goTo('student', '/student')} />}
      {page === 'shop'     && <ShopPage session={session!} onBack={() => goTo('student', '/student')} onCardsAdded={() => goTo('mycards', '/mycards')} />}
    </>
  );
}

export default App;
