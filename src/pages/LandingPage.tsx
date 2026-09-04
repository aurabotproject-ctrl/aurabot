import { useEffect } from 'react';
import { Router } from '../lib/router';
import { initLandingBot } from './landingBot';
import './LandingPage.css';

/**
 * The public landing page — what a visitor sees at "/" before signing in.
 *
 * The 3D Aurabot, the scroll-beat controller and the card showcase all live
 * in landingBot.ts; this component owns the markup and hands that module a
 * mounted DOM to attach to. Every style is scoped to .cc-landing so none of
 * it reaches the app's own screens.
 *
 * In-page links are intercepted here rather than left to the browser: the app
 * uses a hash router, so letting an "#arena" anchor through would change
 * location.hash and bounce the visitor into the app's routing.
 */
export default function LandingPage() {
  useEffect(() => {
    const prevScroll = document.documentElement.style.scrollBehavior;
    const prevBg = document.body.style.background;
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.background = '#0d1330';

    const cleanup = initLandingBot();

    return () => {
      cleanup();
      document.documentElement.style.scrollBehavior = prevScroll;
      document.body.style.background = prevBg;
      window.scrollTo(0, 0);
    };
  }, []);

  const jump = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const go = (window as unknown as { __ccGoTo?: (id: string) => void }).__ccGoTo;
    if (go) go(id);
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const enterApp = () => Router.navigate('/login');

  return (
    <div className="cc-landing">
      <header className="nav">
        <div className="brand"><i /> ClassCard</div>
        <nav className="links">
          <a className="lnk" href="#collect" onClick={(e) => jump(e, 'collect')}>Collect</a>
          <a className="lnk" href="#shop" onClick={(e) => jump(e, 'shop')}>Shop &amp; Trade</a>
          <a className="lnk" href="#arena" onClick={(e) => jump(e, 'arena')}>Arena</a>
          <a className="lnk" href="#teachers" onClick={(e) => jump(e, 'teachers')}>Teachers</a>
          <button type="button" className="btn btn-gold nav-cta" onClick={enterApp}>Let&rsquo;s Go!</button>
        </nav>
      </header>

      <div id="bot" aria-hidden="true" />

      <main>
        <section className="beat left" id="hero">
          <div className="col">
            <p className="eyebrow rv">Classroom collectible cards</p>
            <h1 className="rv">Collect.<br />Trade.<br /><span className="gold">Battle.</span></h1>
            <p className="lead rv">
              Students earn <span className="mark">real cards</span> for <span className="key">real work</span>.
              Weekly projects unlock packs, packs build collections, collections win the Arena.
            </p>
            <div className="btn-row rv">
              <button type="button" className="btn btn-gold" onClick={enterApp}>Let&rsquo;s Go!</button>
              <a className="btn btn-ghost" href="#collect" onClick={(e) => jump(e, 'collect')}>See how it works</a>
            </div>
          </div>
        </section>

        <section className="beat right" id="collect">
          <div className="col">
            <p className="eyebrow rv">01 — The collection</p>
            <h2 className="rv">Every card is <span className="gold">earned</span></h2>
            <p className="lead rv">
              No card arrives by accident. Finish the weekly project, meet the brief, and the card your
              teacher set as the <span className="mark">reward</span> drops into your binder.
            </p>
            <ul className="list rv">
              <li><span className="pip">◆</span><span><b>Holo rares</b> — the standout cards shimmer and tilt in 3D when you open them.</span></li>
              <li><span className="pip">▦</span><span><b>Every space counts</b> — empty slots show what&rsquo;s still missing from a set.</span></li>
              <li><span className="pip">★</span><span><b>Star points</b> bank up from finished work and buy your next pack.</span></li>
            </ul>
            <div className="rarities rv" role="group" aria-label="Card rarity">
              <button type="button" className="rb" data-r="0"><i />Bronze</button>
              <button type="button" className="rb" data-r="1"><i />Silver</button>
              <button type="button" className="rb" data-r="2"><i />Gold</button>
              <button type="button" className="rb is-on" data-r="3" aria-pressed="true"><i />Prismatic</button>
            </div>
            <dl className="stats rv">
              <div><dt>Total cards</dt><dd>248</dd></div>
              <div><dt>Sets</dt><dd>12</dd></div>
              <div><dt>Holo rares</dt><dd>18</dd></div>
            </dl>
          </div>
        </section>

        <section className="beat left" id="shop">
          <div className="col">
            <p className="eyebrow rv">02 — Shop &amp; trade</p>
            <h2 className="rv">Spend your <span className="gold">star points</span> on card packs</h2>
            <p className="lead rv">
              Pick a pack tier and open it, or skip the luck entirely and <span className="key">trade with the class</span> —
              you pick what you&rsquo;re offering, they pick what they&rsquo;re giving.
            </p>
            <div className="tiers rv">
              <div className="tier"><div className="t">Tier I</div><div className="v">Starter</div><div className="c">3 cards</div></div>
              <div className="tier"><div className="t">Tier II</div><div className="v">Collector</div><div className="c">5 cards</div></div>
              <div className="tier rare"><div className="t">Tier III</div><div className="v">Prismatic</div><div className="c">5 + holo</div></div>
            </div>
            <div className="quote rv">
              Offer your cards, choose theirs, and both sides confirm before anything moves.
              <span>Trading, in one sentence</span>
            </div>
          </div>
        </section>

        <section className="beat right" id="arena">
          <div className="col">
            <p className="eyebrow rv">03 — The Arena</p>
            <h2 className="rv">Card combat,<br /><span className="cool">settled fairly</span></h2>
            <p className="lead rv">
              Choose an opponent, send in your strongest card and let <span className="key">attack strength</span> decide it.
              Win and the medal goes on your profile — the whole class can see the standings.
            </p>
            <ul className="list rv">
              <li><span className="pip">⚔</span><span><b>Combat system v2</b> — attack strength comes from the card, not from who shouted first.</span></li>
              <li><span className="pip">◈</span><span><b>Arena medals</b> stack up on your student page.</span></li>
              <li><span className="pip">↺</span><span><b>Battle history</b> so nobody argues about who won last Tuesday.</span></li>
            </ul>
          </div>
        </section>

        <section className="beat left" id="build">
          <div className="col">
            <p className="eyebrow rv">04 — Build a bot</p>
            <h2 className="rv">Design a robot,<br /><span className="gold">make it yours</span></h2>
            <p className="lead rv">
              Stack shapes, set the base colour, tune every part, then save the bot to your profile so it
              greets you each time you sign in.
            </p>
            <ul className="list rv">
              <li><span className="pip">◧</span><span><b>Add shapes</b> and edit any piece you&rsquo;ve placed.</span></li>
              <li><span className="pip">◑</span><span><b>Global base colour</b> to repaint the whole build at once.</span></li>
              <li><span className="pip">☺</span><span><b>Saved to your profile</b> — your bot, on your dashboard.</span></li>
            </ul>
          </div>
        </section>

        <section className="beat right" id="projects">
          <div className="col">
            <p className="eyebrow rv">05 — Weekly projects</p>
            <h2 className="rv">The <span className="gold">work</span> comes first</h2>
            <p className="lead rv">
              Each week your teacher sets the task, states exactly what you need to do, and shows the card you
              could earn for doing it. <span className="key">The reward is visible before you start.</span>
            </p>
            <div className="quote rv">
              Card coming soon — your teacher is preparing it.
              <span>Straight from the student dashboard</span>
            </div>
          </div>
        </section>

        <section className="beat mid" id="teachers">
          <div className="col">
            <p className="eyebrow rv">For teachers</p>
            <h2 className="rv">You set the work.<br /><span className="gold">ClassCard</span> handles the rest.</h2>
            <p className="lead rv">
              Build the weekly project, choose the reward card, watch the collections fill up. Students sign in
              with a <span className="key">PIN</span>, home communication goes out from the same place, and the
              admin view keeps the whole school tidy.
            </p>
            <div className="btn-row rv" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-gold" onClick={enterApp}>Let&rsquo;s Go!</button>
              <a className="btn btn-ghost" href="#collect" onClick={(e) => jump(e, 'collect')}>Take the tour again</a>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div>ClassCard — classroom collectible cards</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '.14em' }}>AURABOT · PROCEDURAL THREE.JS</div>
      </footer>

      <nav className="dots" id="dots" aria-label="Sections" />
      <p className="scrollcue" id="cue">Scroll</p>
    </div>
  );
}
