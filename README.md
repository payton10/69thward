# 69th Ward Draft Derby

Draft-order lottery for the 69th Ward fantasy football league. Live site:
https://payton10.github.io/derby/

Every night at 6:00 PM MT each manager gets a provably-random roll; the draft
order locks in from the bottom up during the final week, ending with a
head-to-head finale for the #1 pick two days before the draft.

**Provably fair:** every number derives from `HMAC-SHA256(seed, year|date|name|purpose)`.
The seed's SHA-256 fingerprint is published on the site before the first roll;
the seed itself is revealed after the finale, and the page recomputes the whole
season in your browser. The seed never touches this repo.

- `engine.py` — deterministic drop engine + page builder (`--selftest` simulates a season)
- `template.html` — the site, including the WebCrypto verifier (mirrors engine bit-for-bit)
- `config.json` — season parameters; phases derive from the draft date
- `drop.sh` + launchd plist — nightly 6:00 PM build-and-publish from the league Mac
