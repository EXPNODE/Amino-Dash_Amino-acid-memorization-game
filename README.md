# Amino Dash

A browser game for learning all 20 standard amino acids. Runs on GitHub Pages with **no installation, build command, backend, account, or API key**.

## Publish it on GitHub Pages

1. Unzip this download.
2. On GitHub, create a new **public repository** (for example, `amino-dash`).
3. Choose **Add file → Upload files**. Upload the **contents** of the `amino-dash` folder, including the `assets` folder. `index.html` must be at the repository’s top level, not inside another `amino-dash` folder. Commit the upload to `main`.
4. Open **Settings → Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
5. Select **main**, select **/(root)**, and click **Save**.
6. Wait for GitHub to finish publishing. The Pages settings show your link, normally `https://YOUR-USERNAME.github.io/amino-dash/`.

That's it. Future edits uploaded to `main` publish automatically. If you see a 404, check that `index.html` is at the root and the Pages deployment has completed. Upload the extracted files, not the ZIP itself.

Official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Play locally

Open `index.html` directly to try it. For reliable browser storage behavior, use a local server instead:

```sh
cd amino-dash
python -m http.server 8000
```

Visit http://localhost:8000. Python is only an optional local server; the published game uses plain HTML, CSS, and JavaScript. All fonts, scripts, and structure images are local; no CDN requests are needed.

## What stayed from the original

- All 20 amino acids, their full names, three-letter codes, one-letter codes, and side chains.
- Four modes: mixed training, names & codes, bidirectional structure matching, and draw/reveal/self-check.
- Twelve-question rounds; mixed rounds always have six name/code questions and six structure questions.
- All six name/code directions and all six structure/name/code directions.
- Adaptive weighted practice, priority for older cards, and missed-card retries after intervening questions. A retry waits until its question type is eligible.
- Familiar directions unlock typed answers at familiarity level 2.
- Case-insensitive typed answers; aspartate and glutamate aliases accepted.
- Combo points, optional speed bonus, gold at 12/12 and silver at 10/12 or above.
- Enlarged structure references, answer feedback, and keyboard shortcuts.
- Original neutral-form chemistry, backbone orientation, and stereochemistry conventions. SVG reference images were generated from the original molecule definitions with RDKit. L-threonine is 2S,3R; L-isoleucine is 2S,3S. Other alpha stereocenters remain unspecified, as in the original.

## New reasons to play another round

- Persistent XP, levels (one per 2,000 XP), personal bests for each mode, medals, and best combo.
- A 24-answer daily goal and a day streak based on the device’s local calendar. Any answered card counts toward the goal; any practice maintains the streak.
- A field guide showing all 20 structures and per-amino-acid familiarity.
- Recent round history and an overview of typed-recall progress.
- Responsive layouts for desktop and phone, visible keyboard focus, and reduced-motion support.
- Optional speed bonuses: turn them off on the home screen for relaxed practice. Existing best scores remain; they are not split by speed setting.

## Drawing studio

A lightweight ChemDraw-style **visual sketcher**, with an amino acid backbone already drawn. No external chemical editor or subscription is required.

- **Bond / Double / Triple / Wedge / Dash:** drag from an atom to extend the molecule. Release on an existing atom to close a ring or connect branches. Bond angles snap in 30-degree increments.
- Click an existing bond with a bond tool to change its type. Click a wedge/dash again to reverse its narrow end.
- **Atom:** select a label from the dropdown, then click an existing atom to replace its label. Click blank space to create an atom.
- **5-ring / 6-ring / Benzene:** click an existing atom to use it as one ring vertex, or click blank space to create a ring. For fused rings, draw extra bonds and close them onto existing vertices.
- **Move:** drag atoms to arrange the structure.
- **Erase:** click an atom or bond. Removing an atom also removes its attached bonds.
- **Undo / Redo:** up to 100 prior drawing operations. **Backbone** resets the sketch and can be undone.
- **I’m drawing on paper:** hides the editor and preserves the original paper-based workflow.
- **Reveal & compare:** view your drawing and the reference side by side. Award **0%, 25%, 50%, 75%, or 100%** credit.

Carbon and carbon-bound hydrogens are implicit. Atom labels are explicit: change `NH2` to `NH` when closing proline’s ring. Include the illustrated stereochemistry for threonine and isoleucine.

The editor does **not** validate valence, compute implicit heteroatom hydrogens, assign stereochemistry, export chemical formats, or auto-grade structures. It is a sketching aid, not a full ChemDraw replacement. The reference is the grading guide. Pointer/touch input is required for editing; paper mode provides an alternative.

### Scoring

A fully correct answer earns 100 points plus a combo bonus of 20 points for each consecutive correct answer after the first, capped at 100 extra points. When enabled, non-drawing questions also earn up to 30 speed points. Partial drawings earn 25, 50, or 75 points, reset the combo, and are queued for retry. Partial credit increases familiarity by half its fraction; a fully correct answer adds 1 (maximum familiarity 8), and a zero-credit answer resets it. Drawing medals use total credit: ten full answers or an equivalent combination earns silver. Drawing is self-reported, so scores are personal practice records.

## Saves, backups, and moving devices

Progress is stored automatically after every answer in **localStorage**, not cookies. Completed rounds add records to your history. There is no server and no automatic device synchronization.

1. Open **Save / restore**.
2. Choose **Copy code** or **Download backup**.
3. Keep the entire `AD1.…` string somewhere safe.
4. On the other device, open the same game, choose **Save / restore**, and paste the string.
5. Click **Review backup**, inspect the summary, then **Replace progress with this backup**.

Restoring **replaces**, rather than merges, existing progress. Export the current save first if you might want it later. Codes include familiarity, queued retries, scores, XP, day history, the latest 50 round results, and the speed setting. They do not include an unfinished round’s position or a current drawing. Already answered questions in unfinished rounds still retain their XP and learning progress.

Codes have a version marker and a checksum to catch incomplete or accidentally damaged copies. They are not encrypted or tamper-proof. Invalid backups are rejected before existing progress changes.

### Import your Python progress

Open the original `~/amino_dash_progress.json`, copy its entire contents, and paste them into the same restore box. Card familiarity and last-seen times migrate. The original app did not store lifetime XP, round history, or streaks, so those begin at zero.

### Storage details

- Saves belong to the browser profile, origin, and game path. A different browser, private window, URL path, custom domain, or device may have a different save.
- Clearing site data removes the save. Export first. A plain cookie-only deletion may leave localStorage, depending on the browser action.
- Private browsing and storage restrictions can prevent persistent saves. The game shows a warning when saving fails; export before closing.
- An unreadable existing save is preserved instead of overwritten. You can download its raw contents from Save / restore.
- If another tab changes the save, the current tab pauses writes and asks you to reload, avoiding a silent overwrite. Play in one tab at a time.
- There is no in-app account, analytics, remote leaderboard, or network transmission of game progress. GitHub serves the static site normally.

## Keyboard controls

- **1–4:** select a multiple-choice answer.
- **Enter:** start a mixed round from the menu, submit typed answers, reveal a drawing, advance feedback, or repeat a completed round.
- **Space:** reveal a drawing or advance feedback.
- **Escape:** return to the menu (or close an open dialog).
- **Tab / Enter / Space:** navigate and activate buttons. Shortcuts do not override text fields or focused controls.
- Click reference structures or right-click answer structures to enlarge them.

## Files and maintenance

| File | Purpose |
| --- | --- |
| `index.html` | Page entry point |
| `style.css` | Responsive layout and appearance |
| `data.js` | Amino acid names, codes, side chains |
| `app.js` | Adaptive gameplay, scores, saves, backups |
| `editor.js` | SVG molecule sketcher |
| `assets/0.svg`–`19.svg` | Original RDKit-generated structure references |
| `.nojekyll` | Disables unnecessary Jekyll processing |

No package manager or build output is involved. All asset paths are relative so the game works under a GitHub repository subpath. Keep save schema compatibility in mind when editing `app.js`.

## Verification

Automated DOM-based smoke tests passed for complete rounds, duplicate-grade protection, persisted saves, backup transfer and checksum rejection, Python migration, mixed-round balance, typed recall, editor bond/ring/label operations and undo/redo, partial-credit retries, and corrupt or blocked storage. Reference molecule construction also passed the original RDKit assertions for threonine and isoleucine stereochemistry.

Live Chromium rendering and real pointer/touch layout checks could not be completed in the delivery environment. The included tests exercise DOM and editor logic with jsdom; they do not simulate a full browser rendering engine. Check the published site in your preferred desktop/mobile browser.

Optional developer check (not required to publish or play):

```sh
npm install --no-save jsdom
node tests/smoke.cjs
```

Do not upload `node_modules` if you run the optional tests.
