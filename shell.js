/* ═══════════════════════════════════════════════════════════════════════════
   WARD SHELL — the ONE header engine. The hub (index.html) and the Derby
   (derby/index.html via template.html) both load THIS file. Styles, markup,
   cached first-paint, and the renderer live here and nowhere else.

   Page config (set BEFORE this script loads):
     window.WARD_SHELL = { mode:'hub' }                             // the hub SPA
     window.WARD_SHELL = { mode:'static', active:'derby', prefix:'../' }  // derby

   Cache contract (localStorage 'wardShell'): {n:name, c:isCommish, p:pendingVotes}
   — written by the hub's refreshMe and the derby's reconciler via saveCache().

   ⚠️ When you edit this file, bump the ?v= on BOTH script tags
      (index.html + template.html) so GitHub Pages caches roll over.
   ═══════════════════════════════════════════════════════════════════════════ */
(function(){
  var CSS = [
    'header.top{display:flex;align-items:center;justify-content:space-between;padding:10px 0 4px}',
    '.brand{font-weight:800;font-size:18px;letter-spacing:-.01em;color:var(--ink);text-decoration:none;display:block}',
    '.brand .sub{display:block;font-size:10px;letter-spacing:.22em;color:var(--gold);text-transform:uppercase;font-weight:700}',
    'nav.tabs{display:flex;gap:4px;margin:12px 0 20px;border-bottom:1px solid var(--grid);padding-bottom:10px;flex-wrap:wrap}',
    '.tab{font-size:13px;color:var(--muted);padding:7px 13px;border-radius:999px;border:1px solid transparent;cursor:pointer;background:none;text-decoration:none;display:inline-block;font-family:inherit}',
    '.tab.on{color:var(--ink);background:var(--surface);border-color:var(--ring);font-weight:700}',
    '.tab.urgent{background:var(--gold);color:#140f02;border-color:var(--gold);font-weight:800;animation:wardpulse 1.6s ease-in-out infinite}',
    '.tab.urgent.on{background:var(--goldbright);border-color:var(--goldbright)}',
    '@keyframes wardpulse{0%,100%{box-shadow:0 0 0 0 rgba(250,178,25,.45)}50%{box-shadow:0 0 0 8px rgba(250,178,25,0)}}',
    '.pchip{display:inline-flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--ring);border-radius:999px;padding:5px 12px 5px 6px;color:var(--ink);font-size:13px;font-weight:700;text-decoration:none;cursor:pointer;font-family:inherit}',
    '.avatar{display:inline-flex;width:30px;height:30px;border-radius:50%;background:var(--gold);color:#140f02;font-weight:800;align-items:center;justify-content:center;font-size:14px}',
    '.wpill{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:6px;padding:2px 7px;margin-left:6px;vertical-align:1px;color:var(--goldbright);border:1px solid rgba(201,133,0,.45);background:rgba(201,133,0,.12)}',
    '.btnc{display:inline-block;border-radius:10px;padding:4px 10px;font-size:12px;font-weight:600;background:var(--accent);border:1px solid var(--accent);color:#fff;text-decoration:none;cursor:pointer;font-family:inherit}'
  ].join('\n');
  var st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);

  var cfg = window.WARD_SHELL || {};
  var PREFIX = cfg.prefix || '';
  var HUB = cfg.mode === 'hub';
  var DERBY_HIDE = new Date('2026-09-03T00:00:00-06:00');  // Derby tab retires the day after the draft
  var TABS = [['home','Home'],['derby','Draft Derby'],['proposals','Proposals'],['vote','Vote'],['rules','Commandments'],['history','Church History']];

  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function cache(){ try{ return JSON.parse(localStorage.getItem('wardShell')||'null'); }catch(e){ return null; } }
  function saveCache(s){ try{ if(s) localStorage.setItem('wardShell',JSON.stringify(s)); else localStorage.removeItem('wardShell'); }catch(e){} }

  function chipHTML(s){
    if(!(s && s.n)){
      return HUB ? '<button class="btnc" onclick="window.openLogin&&openLogin(\'in\')">Sign in</button>'
                 : '<a class="btnc" href="'+PREFIX+'?signin=1">Sign in</a>';
    }
    var n = esc(s.n);
    var inner = '<span class="avatar">'+(n[0]||'?')+'</span>'+n+(s.c?' <span class="wpill">C</span>':'');
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
  }

  // first paint — synchronous, from cache, before any network work
  render(cache(), cfg.active != null ? cfg.active : ((location.hash.slice(1).split('/')[0]) || 'home'));

  window.WardShell = { render:render, chipHTML:chipHTML, tabsHTML:tabsHTML, cache:cache, saveCache:saveCache, TABS:TABS };
})();
