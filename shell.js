/* ═══════════════════════════════════════════════════════════════════════════
   WARD SHELL — shared logic. Loaded by BOTH pages (hub index.html and the
   Derby via template.html). Everything common lives here, once:

     · header renderer (chip + tabs) with synchronous cached first-paint
     · the shell cache contract   (localStorage 'wardShell' = {n,c,p})
     · Supabase project constants (WardShell.SUPA)
     · the member-matching rule   (WardShell.matchMember)
     · esc(), toast(), the footer line

   Styles live in shell.css (linked in each page's <head>).
   Page config, set BEFORE this script loads:
     window.WARD_SHELL = { mode:'hub' }                                   // hub SPA
     window.WARD_SHELL = { mode:'static', active:'derby', prefix:'../' }  // derby

   ⚠️ When you edit this file (or shell.css), bump the ?v= on the <link> and
      <script> tags in BOTH index.html and template.html (Pages caching).
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
  var cfg = window.WARD_SHELL || {};
  var PREFIX = cfg.prefix || '';
  var HUB = cfg.mode === 'hub';
  var DERBY_HIDE = new Date('2026-09-03T00:00:00-06:00');  // Derby tab retires the day after the draft
  var TABS = [['home','Home'],['derby','Draft Derby'],['proposals','Proposals'],['vote','Vote'],['rules','Commandments'],['history','Church History']];
  var SUPA = { url:'https://wdfkzkkcyhzrbmipgiil.supabase.co', key:'sb_publishable_YKSRpVgAy4xL64CRzGnRyw_kf4SkX1m' };
  var FOOTER = 'The 69th Ward · Buy-in $20 + $2/loss · Playoff loser eats the herring 🐟';

  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function cache(){ try{ return JSON.parse(localStorage.getItem('wardShell')||'null'); }catch(e){ return null; } }
  function saveCache(s){ try{ if(s) localStorage.setItem('wardShell',JSON.stringify(s)); else localStorage.removeItem('wardShell'); }catch(e){} }

  /* THE member-matching rule: session email → roster row. Handles the real-email
     identity (email or contact_email) and legacy synthetic w<digits>@69thward.app. */
  function matchMember(members, sessionEmail){
    var uem = (sessionEmail||'').toLowerCase();
    var sm = uem.match(/^w(\d+)@69thward\.app$/);
    return (members||[]).find(function(m){
      return sm ? m.phone===sm[1] : (m.email===uem || (m.contact_email||'').toLowerCase()===uem);
    }) || null;
  }

  function toast(t, ms){
    var d=document.createElement('div'); d.textContent=t;
    d.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--surface2);border:1px solid var(--ring);border-radius:999px;padding:8px 18px;font-size:13px;z-index:99;color:var(--ink)';
    document.body.appendChild(d); setTimeout(function(){ d.remove(); }, ms||1800);
  }

  function chipHTML(s){
    if(!(s && s.n)){
      return HUB ? '<button class="btn sm primary" onclick="window.openLogin&&openLogin(\'in\')">Sign in</button>'
                 : '<a class="btn sm primary" href="'+PREFIX+'?signin=1">Sign in</a>';
    }
    var n = esc(s.n);
    var inner = '<span class="avatar">'+(n[0]||'?')+'</span>'+n+(s.c?' <span class="pill gold">C</span>':'');
    return HUB ? '<button class="pchip" onclick="window.toggleMenu&&toggleMenu()">'+inner+'</button>'
               : '<a class="pchip" href="'+PREFIX+'#home">'+inner+'</a>';
  }

  function tabsHTML(s, active){
    var urgent = s && s.n && s.p > 0;
    return TABS.filter(function(t){ return t[0]!=='derby' || new Date() < DERBY_HIDE; }).map(function(t){
      var k=t[0], l=t[1], on = active===k ? ' on' : '';
      if(k==='derby' && active==='derby') return '<span class="tab on">'+l+'</span>';
      if(k==='vote' && urgent) return '<a class="tab urgent'+on+'" href="'+PREFIX+'#vote">🗳️ Vote · '+s.p+'</a>';
      var href = k==='derby' ? PREFIX+'derby/' : PREFIX+'#'+k;
      return '<a class="tab'+on+'" href="'+href+'">'+l+'</a>';
    }).join('');
  }

  function render(s, active){
    var who=document.getElementById('who'), tabs=document.getElementById('tabs');
    if(who) who.innerHTML = chipHTML(s);
    if(tabs) tabs.innerHTML = tabsHTML(s, active);
    var f=document.getElementById('foot');
    if(f && !f.textContent) f.textContent = FOOTER;
  }

  // first paint — synchronous, from cache, before any network work
  render(cache(), cfg.active != null ? cfg.active : ((location.hash.slice(1).split('/')[0]) || 'home'));
  // the footer element parses after this script — fill it when the DOM is ready
  document.addEventListener('DOMContentLoaded', function(){
    var f=document.getElementById('foot'); if(f && !f.textContent) f.textContent = FOOTER;
  });

  window.WardShell = { render:render, chipHTML:chipHTML, tabsHTML:tabsHTML,
                       cache:cache, saveCache:saveCache, matchMember:matchMember,
                       esc:esc, toast:toast, SUPA:SUPA, FOOTER:FOOTER, TABS:TABS };
})();
