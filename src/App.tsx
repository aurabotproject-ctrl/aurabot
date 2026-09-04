import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import TeacherPage from './pages/TeacherPage';
import StudentPage from './pages/StudentPage';
import AdminPage from './pages/AdminPage';
import ArenaPage from './pages/ArenaPage';
import BuildABotPage from './pages/BuildABotPage';
import MyCardsPage from './pages/MyCardsPage';
import ShopPage from './pages/ShopPage';
import SetPinPage from './pages/SetPinPage';
import ThreeDAuraPage from './pages/ThreeDAuraPage';
import LandingPage from './pages/LandingPage';
import { Auth } from './lib/auth';
import { Router } from './lib/router';
import type { Session } from './lib/auth';

type Page = 'landing' | 'login' | 'teacher' | 'student' | 'admin' | 'arena' | 'buildabot' | 'mycards' | 'shop' | 'setpin' | '3daura';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>('landing');

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
        // Signed out: "/" is the public landing page, "#/login" is the sign-in
        // screen. Anything else a signed-out visitor asks for goes to "/".
        if (path === '/login') {
          setPage('login');
        } else {
          if (path !== '/') Router.replace('/');
          setPage('landing');
        }
      } else {
        const role = s.profile.role;
        // A student who hasn't set their own PIN yet is forced here no matter
        // what path they were trying to reach — no way to skip this step.
        if (role === 'student' && s.mustChangePin) {
          setPage('setpin');
        } else if (path === '/' || path === '/login') {
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
        } else if (path.startsWith('/3daura')) {
          // Teachers are allowed in as read-only visitors, so they can look
          // inside the worlds their class has built. The game itself gives a
          // non-student no way to build, buy or save anything.
          if (role !== 'student' && role !== 'admin' && role !== 'teacher') { Router.navigate('/'); setPage('login'); }
          else setPage('3daura');
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
      {page === 'landing'  && <LandingPage />}
      {page === 'login'    && <LoginPage />}
      {page === 'setpin'   && <SetPinPage session={session!} onSignOut={handleSignOut} onDone={() => { Router.navigate('/student'); init(); }} />}
      {page === 'teacher'  && <TeacherPage session={session!} onSignOut={handleSignOut} />}
      {page === 'student'  && <StudentPage session={session!} onSignOut={handleSignOut} />}
      {page === 'admin'    && <AdminPage session={session!} onSignOut={handleSignOut} />}
      {page === 'arena'    && <ArenaPage session={session!} />}
      {page === 'buildabot' && <BuildABotPage onBack={() => goTo('student', '/student')} userId={session?.user.id ?? ''} />}
      {page === 'mycards'  && <MyCardsPage session={session!} onBack={() => goTo('student', '/student')} />}
      {page === 'shop'     && <ShopPage session={session!} onBack={() => goTo('student', '/student')} onCardsAdded={() => goTo('mycards', '/mycards')} />}
      {page === '3daura'   && <ThreeDAuraPage />}
    </>
  );
}

export default App;
