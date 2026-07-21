#!/usr/bin/env python3
"""69th Ward Draft Derby — deterministic drop engine.

Everything derives from (master_seed, config). Rolls are pure functions of
(seed, date, name, purpose): re-running any day reproduces it bit-for-bit,
and the in-page WebCrypto verifier mirrors this derivation exactly.

Usage:
  python3 engine.py                      # build index.html for today (site state auto)
  python3 engine.py --as-of 2026-08-24   # build as of a given local date (testing)
  python3 engine.py --reveal             # embed the seed (run after the finale)
  python3 engine.py --selftest           # simulate the full season, print checks

Seed file: ~/.config/claude/derby/seed_<year>.txt (hex). Never in the repo.
Roll formula (the verifier's contract — DO NOT change without bumping both):
  bytes = HMAC-SHA256(key=seed_hex_utf8, msg="<year>|<date>|<name>|<purpose>")
  value = (first 8 bytes as big-endian uint64) % 20 + 1
"""
import argparse, datetime as dt, hashlib, hmac, json, sys
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
CFG = json.loads((HERE / "config.json").read_text())
TZ = ZoneInfo(CFG["tz"])
SEED_PATH = Path.home() / ".config" / "claude" / "derby" / f"seed_{CFG['year']}.txt"
EVENTS = ["surstromming", "beermile", "diner", "trophy", "swap"]
EVENT_LABEL = {
    "surstromming": "Surströmming Surge", "beermile": "Beer Mile",
    "diner": "24-Hour Diner", "trophy": "Trophy Bump", "swap": "The Swap",
}

def d(s): return dt.date.fromisoformat(s)

def load_seed(required=True):
    if SEED_PATH.exists():
        return SEED_PATH.read_text().strip()
    if required:
        sys.exit(f"seed file missing: {SEED_PATH} (generate on launch day)")
    return None

def hb(seed, msg):
    return hmac.new(seed.encode(), msg.encode(), hashlib.sha256).digest()

def hint(seed, msg):
    return int.from_bytes(hb(seed, msg)[:8], "big")

def roll(seed, date, name, purpose):
    return hint(seed, f"{CFG['year']}|{date}|{name}|{purpose}") % 20 + 1

# ---------- calendar ----------
def calendar():
    launch, draft = d(CFG["launch_date"]), d(CFG["draft_date"])
    finale = draft - dt.timedelta(days=2)
    lock_start = finale - dt.timedelta(days=CFG["lock_days"])          # 8 lock nights before finale
    surge_start = lock_start - dt.timedelta(days=CFG["surge_days"])
    days = []
    day = launch
    while day <= finale:
        if day == finale: phase = "finale"
        elif day >= lock_start: phase = "lock"
        elif day >= surge_start: phase = "surge"
        else: phase = "warmup"
        days.append((day, phase))
        day += dt.timedelta(days=1)
    return days, {"launch": launch, "surge_start": surge_start,
                  "lock_start": lock_start, "finale": finale, "draft": draft}

def event_schedule(seed, days):
    """2 event days per Mon-Sun week, drawn from the seed. Never the finale."""
    weeks = {}
    for day, phase in days:
        if phase == "finale": continue
        weeks.setdefault(day.isocalendar()[:2], []).append(day)
    chosen = {}
    for wk, wdays in weeks.items():
        ranked = sorted(wdays, key=lambda x: hint(seed, f"evday|{x}"))
        for day in ranked[:CFG["events_per_week"]]:
            ev = EVENTS[hint(seed, f"evtype|{day}") % len(EVENTS)]
            chosen[day] = ev
    return chosen

# ---------- simulation ----------
def simulate(seed, as_of):
    """Replay every drop from launch through min(as_of, finale). Pure."""
    days, marks = calendar()
    managers = CFG["managers"]
    ev_sched = event_schedule(seed, days)
    totals = {m: 0 for m in managers}
    best_day = {m: 0 for m in managers}
    locked = {}            # name -> pick
    open_picks = list(range(10, 2, -1))   # 10,9,...,3 (finale settles 2 and 1)
    prev_day_totals = None
    drops = []

    for day, phase in days:
        if day > as_of: break
        alive = [m for m in managers if m not in locked]
        n = 1 if phase == "warmup" else 3
        ev = ev_sched.get(day) if phase != "finale" else None
        if ev == "trophy" and prev_day_totals is None: ev = "beermile"

        day_rolls, notes = {}, []
        for m in (alive if phase == "finale" else alive):
            parts = [roll(seed, day, m, f"roll{k}") for k in range(1, n + 1)]
            day_rolls[m] = {"parts": parts, "total": sum(parts)}

        if ev == "surstromming":
            t = alive[hint(seed, f"evtgt|{day}") % len(alive)]
            day_rolls[t]["total"] *= 2; day_rolls[t]["event"] = "x2"
            notes.append({"event": ev, "who": [t]})
        elif ev == "beermile":
            for m in alive:
                re = sum(roll(seed, day, m, f"bm{k}") for k in range(1, n + 1))
                if re > day_rolls[m]["total"]:
                    day_rolls[m]["total"] = re; day_rolls[m]["event"] = "rerolled"
            notes.append({"event": ev, "who": alive})
        elif ev == "diner":
            t = alive[hint(seed, f"evtgt|{day}") % len(alive)]
            second = sum(roll(seed, day, t, f"dn{k}") for k in range(1, n + 1))
            if second < day_rolls[t]["total"]:
                day_rolls[t]["total"] = second; day_rolls[t]["event"] = "kept worse"
            notes.append({"event": ev, "who": [t]})
        elif ev == "trophy":
            elig = [m for m in alive if m in prev_day_totals]
            if elig:
                t = min(elig, key=lambda m: (prev_day_totals[m], managers.index(m)))
                day_rolls[t]["total"] += 15; day_rolls[t]["event"] = "+15"
                notes.append({"event": ev, "who": [t]})
        elif ev == "swap":
            i = hint(seed, f"evtgt|{day}") % len(alive)
            j = hint(seed, f"evtgt2|{day}") % (len(alive) - 1)
            a, b = alive[i], [m for m in alive if m != alive[i]][j]
            day_rolls[a]["total"], day_rolls[b]["total"] = day_rolls[b]["total"], day_rolls[a]["total"]
            day_rolls[a]["event"] = day_rolls[b]["event"] = "swapped"
            notes.append({"event": ev, "who": [a, b]})

        for m in alive:
            totals[m] += day_rolls[m]["total"]
            best_day[m] = max(best_day[m], day_rolls[m]["total"])

        locks_tonight = []
        def tie_key(m):
            return (totals[m], best_day[m],
                    hint(seed, f"tie|{day}|{m}"))  # ascending: worst first
        if phase == "lock" and open_picks:
            loser = min(alive, key=tie_key)
            pick = open_picks.pop(0)
            locked[loser] = pick
            locks_tonight.append({"name": loser, "pick": pick})
        elif phase == "finale":
            a2 = sorted(alive, key=tie_key, reverse=True)   # best first
            locked[a2[0]] = 1; locked[a2[1]] = 2
            locks_tonight = [{"name": a2[0], "pick": 1}, {"name": a2[1], "pick": 2}]

        prev_day_totals = {m: day_rolls[m]["total"] for m in alive}
        drops.append({
            "n": len(drops) + 1, "date": day.isoformat(), "phase": phase,
            "event": ev, "eventLabel": EVENT_LABEL.get(ev), "notes": notes,
            "rolls": {m: day_rolls[m] for m in day_rolls},
            "locks": locks_tonight,
            "standings": sorted(
                ({"name": m, "pts": totals[m], "locked": locked.get(m)} for m in managers),
                key=lambda r: (-r["pts"],)),
        })
    return {"drops": drops, "totals": totals, "locked": locked,
            "marks": {k: v.isoformat() for k, v in marks.items()},
            "phases": [(day.isoformat(), ph) for day, ph in days]}

# ---------- factual commentary (Claude may override via commentary.json) ----------
def commentary(sim):
    lines = {}
    for drop in sim["drops"]:
        out = []
        for lk in drop["locks"]:
            out.append(f"🔒 {lk['name']} locks in at pick {lk['pick']}.")
        if drop["event"]:
            who = ", ".join(drop["notes"][0]["who"]) if drop["notes"] else ""
            out.append(f"{EVENT_LABEL[drop['event']]} hit: {who}.")
        top = max(drop["rolls"].items(), key=lambda kv: kv[1]["total"])
        out.append(f"Big roller: {top[0]} +{top[1]['total']}.")
        lines[drop["date"]] = out
    custom_path = HERE / "commentary.json"
    if custom_path.exists():
        lines.update(json.loads(custom_path.read_text()))
    return lines

# ---------- page build ----------
def build(as_of=None, reveal=False):
    now = dt.datetime.now(TZ)
    as_of_date = d(as_of) if as_of else now.date()
    launch = d(CFG["launch_date"])
    seed = load_seed(required=CFG["seed_hash"] is not None)
    state = "pre" if (as_of_date < launch or CFG["seed_hash"] is None) else "live"
    sim = simulate(seed, as_of_date) if state != "pre" else {"drops": [], "totals": {}, "locked": {},
        "marks": {k: v.isoformat() for k, v in calendar()[1].items()},
        "phases": [(day.isoformat(), ph) for day, ph in calendar()[0]]}
    if sim["drops"] and sim["drops"][-1]["phase"] == "finale":
        state = "final"
    data = {
        "cfg": {k: CFG[k] for k in ("year", "league", "title", "managers", "launch_date",
                                     "draft_date", "draft_time_label", "drop_hour_local", "seed_hash")},
        "state": state, "asOf": as_of_date.isoformat(),
        "marks": sim["marks"], "phases": sim["phases"],
        "drops": sim["drops"][-3:], "allTotals": sim["totals"], "locked": sim["locked"],
        "dropCount": len(sim["drops"]),
        "fullHistory": [{"date": x["date"], "rolls": {m: x["rolls"][m]["total"] for m in x["rolls"]},
                          "locks": x["locks"], "event": x["event"]} for x in sim["drops"]],
        "commentary": commentary(sim) if state != "pre" else {},
        "revealedSeed": seed if (reveal and state == "final") else None,
        "builtAt": now.isoformat(),
    }
    template = (HERE / "template.html").read_text()
    page = template.replace("/*__DATA__*/null", json.dumps(data, ensure_ascii=False))
    (HERE / "index.html").write_text(page)
    print(f"built index.html · state={state} · drops={len(sim['drops'])} · as_of={as_of_date}")

def selftest():
    seed = "testseed-" + "0" * 32
    days, marks = calendar()
    sim = simulate(seed, marks["finale"])
    sim2 = simulate(seed, marks["finale"])
    assert json.dumps(sim, default=str) == json.dumps(sim2, default=str), "non-deterministic!"
    picks = sorted(sim["locked"].values())
    assert picks == list(range(1, 11)), f"picks wrong: {picks}"
    lock_nights = [x for x in sim["drops"] if x["phase"] == "lock" and x["locks"]]
    assert len(lock_nights) == CFG["lock_days"], f"lock nights {len(lock_nights)}"
    assert sim["drops"][-1]["phase"] == "finale" and len(sim["drops"][-1]["locks"]) == 2
    evs = [x["event"] for x in sim["drops"] if x["event"]]
    order = [name for name, _ in sorted(sim["locked"].items(), key=lambda kv: kv[1])]
    print(f"SELFTEST PASS · {len(sim['drops'])} drops · {len(evs)} events {dict((e, evs.count(e)) for e in set(evs))}")
    print("final order:", " → ".join(order))
    print("calendar:", {k: str(v) for k, v in marks.items()})

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--as-of"); ap.add_argument("--reveal", action="store_true")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest: selftest()
    else: build(a.as_of, a.reveal)
