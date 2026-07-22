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

  /* ── profile: chip + dropdown menu — ONE implementation, both pages ──
     The chip label/badge come from the lightweight shell cache {n,c}; the menu's
     phone/email come from the full member object (set once it's fetched). The menu
     is fully interactive on BOTH pages: info, Manage the Ward (commish), Sign out. */
  var _menuOpen=false, _lastShell=null, _member=null;

  function fmtPhone(d){ d=(d||'').replace(/^1/,''); return d.length===10 ? '('+d.slice(0,3)+') '+d.slice(3,6)+'-'+d.slice(6) : (d||''); }

  function signInHTML(){
    return HUB ? '<button class="btn sm primary" onclick="window.openLogin&&openLogin(\'in\')">Sign in</button>'
               : '<a class="btn sm primary" href="'+PREFIX+'?signin=1">Sign in</a>';
  }
  // chipHTML kept for back-compat: chip only, no menu.
  function chipHTML(s){
    if(!(s && s.n)) return signInHTML();
    var n=esc(s.n);
    var inner='<span class="avatar">'+(n[0]||'?')+'</span>'+n+(s.c?' <span class="pill gold">C</span>':'');
    return HUB ? '<button class="pchip" onclick="window.WardShell.toggleMenu()">'+inner+'</button>'
               : '<a class="pchip" href="'+PREFIX+'#home">'+inner+'</a>';
  }

  function menuHTML(m){
    var n=esc(m.name);
    return '<div class="pmenu">'
      + '<b>'+n+'</b>'+(m.is_commissioner?' <span class="pill gold">Commissioner</span>':'')
      + '<div class="meta" style="margin-top:6px">📱 '+esc(fmtPhone(m.phone))+'</div>'
      + '<div class="meta" style="margin-top:6px">✉️ '+esc(m.contact_email||'no email on file')+'</div>'
      + '<div class="meta" style="margin-top:4px;font-size:10.5px">Password resets go to this email. Need it changed? Tell the commissioner.</div>'
      + (m.is_commissioner ? '<div style="margin-top:10px"><a class="btn sm" href="'+PREFIX+'#members" onclick="window.WardShell.closeMenu(1)">👥 Manage the Ward</a></div>' : '')
      + '<div style="margin-top:10px"><button class="btn sm ghost" onclick="window.WardShell.signOut()">Sign out</button></div>'
      + '</div>';
  }

  function whoHTML(s, member, open){
    if(!(s && s.n)) return signInHTML();
    var m = member || {name:s.n, is_commissioner:s.c, phone:'', contact_email:''};
    var n=esc(m.name);
    var chip='<button class="pchip" onclick="window.WardShell.toggleMenu()"><span class="avatar">'+(n[0]||'?')+'</span>'+n+(m.is_commissioner?' <span class="pill gold">C</span>':'')+'</button>';
    return chip + (open ? menuHTML(m) : '');
  }

  // renderWho: draw the top-right profile area. shell = {n,c,p} (cache shape);
  // member = full roster row (or null). Also stashes state so toggleMenu can repaint.
  function renderWho(shell, member){
    _lastShell = shell; if(member !== undefined) _member = member;
    var who=document.getElementById('who'); if(!who) return;
    who.innerHTML = whoHTML(shell, _member, _menuOpen);
  }
  function toggleMenu(){ _menuOpen=!_menuOpen; renderWho(_lastShell, _member); }
  function closeMenu(noRepaint){ _menuOpen=false; if(!noRepaint) renderWho(_lastShell, _member); }  // noRepaint: nav link sets the flag, the page's own render repaints
  function signOut(){
    _menuOpen=false; saveCache(null);
    var reload=function(){ location.reload(); };
    try{
      var c = (window.supabase && window.supabase.createClient) ? window.supabase.createClient(SUPA.url, SUPA.key) : null;
      if(c && c.auth && c.auth.signOut){ Promise.resolve(c.auth.signOut()).then(reload, reload); } else reload();
    }catch(e){ reload(); }
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
    renderWho(s);  // chip from cache; menu details fill in when a member is set
    var tabs=document.getElementById('tabs');
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
                       renderWho:renderWho, toggleMenu:toggleMenu, closeMenu:closeMenu, signOut:signOut, fmtPhone:fmtPhone,
                       cache:cache, saveCache:saveCache, matchMember:matchMember,
                       esc:esc, toast:toast, SUPA:SUPA, FOOTER:FOOTER, TABS:TABS };
})();
