# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> C-sUAS app loads and renders main UI
- Location: test\smoke.spec.js:3:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Failed to load resource: the server responded with a status of 404 (File not found)",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e4]:
      - heading "Browser CsUAS Sim v2.00" [level=1] [ref=e5]
      - paragraph [ref=e6]: Single-file browser prototype for a component-system discrete event simulation. The current slice runs one hardcoded Red UAS against one Blue sensor / effector site, then pushes detections through tracking, classification, C2, firing, damage, logging, and Monte Carlo reporting.
  - generic [ref=e7]:
    - generic [ref=e8]:
      - button "New Scenario" [ref=e9] [cursor=pointer]
      - button "Load Scenario" [ref=e10] [cursor=pointer]
      - button "Save Scenario" [ref=e11] [cursor=pointer]
    - generic [ref=e12]:
      - generic [ref=e13]: No map selection
      - button "Run Monte Carlo" [ref=e14] [cursor=pointer]
  - generic [ref=e15]:
    - button "Scenario Editor" [ref=e16] [cursor=pointer]
    - button "Template Wizard" [ref=e17] [cursor=pointer]
    - button "Rosters" [ref=e18] [cursor=pointer]
    - button "Debrief" [ref=e19] [cursor=pointer]
    - button "Export" [ref=e20] [cursor=pointer]
  - generic [ref=e21]:
    - generic [ref=e22]:
      - generic [ref=e23]:
        - button "Run Single Scenario" [ref=e24] [cursor=pointer]
        - button "Run Monte Carlo" [ref=e25] [cursor=pointer]
        - button "Load Scenario JSON" [ref=e26] [cursor=pointer]
        - button "Export Scenario JSON" [ref=e27] [cursor=pointer]
        - button "Reset Scenario View" [ref=e28] [cursor=pointer]
        - generic [ref=e29]:
          - generic [ref=e30]: Iterations
          - spinbutton "Iterations" [ref=e31]: "25"
      - generic [ref=e32]:
        - generic [ref=e33]:
          - generic [ref=e34]: Status
          - strong [ref=e35]: Ready
        - generic [ref=e36]:
          - generic [ref=e37]: Playback
          - strong [ref=e38]: Idle
        - generic [ref=e39]:
          - generic [ref=e40]: Queue
          - strong [ref=e41]: "0"
        - generic [ref=e42]:
          - generic [ref=e43]: Last seed
          - strong [ref=e44]: "-"
        - generic [ref=e45]:
          - generic [ref=e46]: Scenario
          - strong [ref=e47]: Baseline Vertical Slice
      - generic [ref=e49]:
        - strong [ref=e50]: "Reminder:"
        - text: if you edited the Scenario Editor, click
        - strong [ref=e51]: Build Scenario From Editor
        - text: first. Running now uses the current active scenario, not the unsaved editor draft.
    - generic [ref=e52]:
      - generic [ref=e53]:
        - generic [ref=e54]:
          - generic [ref=e55]:
            - heading "Simulation Map" [level=2] [ref=e56]
            - paragraph [ref=e57]: Live tactical view with track, cueing, threat-heading, and field-of-view overlays.
          - generic [ref=e58]:
            - button "Reset Zoom" [ref=e59] [cursor=pointer]
            - button "Build / Edit Scenario" [ref=e60] [cursor=pointer]
            - button "Edit Templates" [ref=e61] [cursor=pointer]
            - button "Review Analysis" [ref=e62] [cursor=pointer]
        - generic [ref=e65]:
          - generic [ref=e66]: Blue object / coverage
          - generic [ref=e67]: Red physical object / intent heading
          - generic [ref=e68]: Track belief
      - generic [ref=e69]:
        - generic [ref=e70]:
          - generic [ref=e71]:
            - generic [ref=e72]:
              - heading "Blue Force Feed" [level=3] [ref=e73]
              - text: Blue sensing, cueing, C2, and engagement actions
            - strong [ref=e74]: "0"
          - generic [ref=e76]: No events yet.
        - generic [ref=e77]:
          - generic [ref=e78]:
            - generic [ref=e79]:
              - heading "Red Force Feed" [level=3] [ref=e80]
              - text: Threat route, attack-run, and terminal behavior
            - strong [ref=e81]: "0"
          - generic [ref=e83]: No events yet.
        - generic [ref=e84]:
          - generic [ref=e86]:
            - heading "Live Metrics" [level=3] [ref=e87]
            - text: Current run status, snapshots, and fast debrief
          - generic [ref=e88]:
            - generic [ref=e89]:
              - text: Detected
              - generic [ref=e90]: "-"
            - generic [ref=e91]:
              - text: Classified
              - generic [ref=e92]: "-"
            - generic [ref=e93]:
              - text: Identified
              - generic [ref=e94]: "-"
            - generic [ref=e95]:
              - text: Intent
              - generic [ref=e96]: "-"
            - generic [ref=e97]:
              - text: Tracks Dropped
              - generic [ref=e98]: "-"
            - generic [ref=e99]:
              - text: Shots Fired
              - generic [ref=e100]: "-"
            - generic [ref=e101]:
              - text: HQ Survived
              - generic [ref=e102]: "-"
            - generic [ref=e103]:
              - text: Weighted Score
              - generic [ref=e104]: "-"
            - generic [ref=e105]:
              - text: Destroyed
              - generic [ref=e106]: "-"
            - generic [ref=e107]:
              - text: Kill Time
              - generic [ref=e108]: "-"
          - generic [ref=e109]:
            - generic [ref=e110]:
              - text: Assessment Snapshots
              - generic [ref=e111]: "-"
            - generic [ref=e112]:
              - text: First Detection
              - generic [ref=e113]: "-"
            - generic [ref=e114]:
              - text: Track Status
              - generic [ref=e115]: "-"
            - generic [ref=e116]:
              - text: Intent
              - generic [ref=e117]: "-"
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | 
  3  | test('C-sUAS app loads and renders main UI', async ({ page }) => {
  4  |   const errors = [];
  5  | 
  6  |   page.on('console', msg => {
  7  |     if (msg.type() === 'error') errors.push(msg.text());
  8  |   });
  9  | 
  10 |   await page.goto('/index.html');
  11 | 
  12 |   await expect(page.getByRole('heading', { name: /Browser CsUAS Sim v2\.00/i })).toBeVisible();
  13 |   await expect(page.getByRole('button', { name: /Run Single Scenario/i })).toBeVisible();
  14 |   await expect(page.locator('#status-text')).toContainText(/ready/i);
  15 | 
> 16 |   expect(errors).toEqual([]);
     |                  ^ Error: expect(received).toEqual(expected) // deep equality
  17 | });
  18 | 
  19 | test('single scenario run completes', async ({ page }) => {
  20 |   await page.goto('/index.html');
  21 | 
  22 |   await page.getByRole('button', { name: /Run Single Scenario/i }).click();
  23 | 
  24 |   await expect(page.locator('#status-text')).toContainText(/complete|ready|finished/i, {
  25 |     timeout: 15000
  26 |   });
  27 | 
  28 |   await expect(page.locator('#event-log')).not.toBeEmpty();
  29 | });
  30 | 
```