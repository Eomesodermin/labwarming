# Labwarming: Design Doc and Milestone Build Plan

Working title: **Labwarming** (like a housewarming, but for a lab). Version of this doc: 1.1. Status: plan only, no code yet.

This doc is written for two readers. Dillon reads it to check the game is the one he wants. The implementing agent reads it to build the game milestone by milestone without asking questions. Where a number or choice is given, it is the decision. Change it in the content tables later, not in the code.

---

## 0. Where to build

- **Repository:** `Eomesodermin/labwarming` on GitHub (https://github.com/Eomesodermin/labwarming). Public, so GitHub Pages works on a free account.
- Build everything in this repository. The Vite project lives at the repository root, not in a subfolder.
- Default branch is `main`. Work on one branch per milestone (`m1-walking-skeleton`, `m2-...`), open a pull request per milestone, and merge after Dillon has tried it.
- This design doc is copied into the repository as `docs/design-doc.md` in milestone 1. From then on the repository copy is the source of truth.
- The live link will be `https://eomesodermin.github.io/labwarming/`.

---

## 1. Pitch and design pillars

**Pitch.** You are a postdoc with one small room, a bench, a hood and a fridge that hums in a worrying way. You split cells, run experiments, write papers and win grants. Each grant buys another room, another machine, another colleague. You can leave the work to your staff or wander in and do it yourself. Your PI emails from airports. Reviewer 2 has thoughts. Nothing ever burns down. In about 30 minutes the tiny lab becomes a four-room corner of a research building, and the long game is the whole building.

**Pillars.**

| # | Pillar | What it means in practice |
|---|---|---|
| 1 | Cozy, never frantic | No fail state. No timers that punish. Deadlines extend. Failures cost a little time and deliver a joke. Build mode pauses the clock. |
| 2 | Hands-on or hands-off | Every job can be done by the player at a station with one key. Every job can also be handed to staff. Doing it by hand is pleasant and slightly faster. |
| 3 | True to wet-lab life | The humour comes from things that really happen: media runs out, the order is lost, the autoclave makes a noise, the PI wants slides tonight. Affectionate, never mean. |
| 4 | Every purchase removes a chore | Each room, machine or hire visibly takes a job off the player's plate. That relief is the reward loop. |
| 5 | Simulation first | All rules live in pure TypeScript with no rendering code. The view only draws state. This keeps balancing easy and porting cheap. |

---

## 2. Core loop and the first 30 minutes

### 2.1 Core loop

1. **Culture.** Split cells at the hood. Cultures grow in the incubator.
2. **Experiment.** Run an experiment at the bench with a ready culture and an assay kit. This produces Data, a dirty flask and waste.
3. **Upkeep.** Wash flasks, make media, put away orders, take out waste, tidy up.
4. **Write.** Turn Data into papers and presentations at the desk.
5. **Fund.** Papers and presentations earn Reputation and unlock grants. Grants pay money.
6. **Expand.** Money buys rooms, equipment, upgrades and staff. Staff take over steps 1 to 3.
7. **Events** arrive by email along the way: PI requests, failures, inspections, deadlines.

### 2.2 Time model for the player

- One game day runs from 08:00 to 18:00 and lasts 4 real minutes at normal speed. One game hour is 24 real seconds.
- At 18:00 an end-of-day card appears: money in, salaries out, things that happened, one joke line. The game autosaves. The next day starts at 08:00. Nothing happens overnight. Everyone carries on where they were.
- Speeds: pause, 1x, 2x. Build mode always pauses.
- A 30-minute session is 7.5 game days.

### 2.3 Session flow, minute by minute

Times are real minutes at 1x speed. This is the target the balance test checks (section 12.3).

| Min | Game time | What the player does | What the game does |
|---|---|---|---|
| 0 | Day 1, 08:00 | Types a name. Reads a welcome email from Prof. Quince. | A sticky-note to-do list appears: "Split some cells." |
| 0 to 2 | Day 1 | Walks to the hood, splits cells twice. Runs a first experiment. Washes a flask. | To-do list steps tick off. First Data appears with a small sparkle. |
| 2 to 3 | Day 1, 13:00 | Makes media. Tries to order kits. The fridge is full. | Email: "The fridge is warm again." To-do: "Repair the fridge." |
| 3 | Day 1 | Repairs the fridge (150). Orders assay kits. Puts the box away. | Fridge capacity doubles. Humming stops. |
| 4 | Day 1, 18:00 | Reads the first end-of-day card. | Core funding +100. Autosave. |
| 4.5 | Day 2, 09:00 | Reads the first PI email. Accepts "just a quick one". | PI request: 3 experiments by Day 3, 12:00. |
| 5 to 8 | Day 2 | Runs the loop by hand. About 1 experiment per minute. | PI request completes around minute 7. Reward 200 and +5 Reputation. |
| 8 to 9 | Day 3 | Writes the first paper (50 Data). | Accepted. "Reviewer 2 was on holiday." +250, +10 Reputation. Equipment Call grant is announced with a deadline. |
| 9.5 to 10 | Day 3 | Applies for the Seedling Grant. | Awarded 1,200. Prof. Quince brings cake. |
| 10 to 12 | Day 3 | Enters build mode. Buys the Wash-up Room and an autoclave. Hires wash-up crew and a technician. | **Room 2. Staff types 1 and 2.** Staff start walking and working. |
| 12 to 15 | Day 4 | Lets staff run the loop. Upgrades the incubator. Writes paper 2. | First contamination. Reviewer 2 asks for a minor revision. Paper 2 accepted. |
| 15 to 16 | Day 4 | Builds the Break Room and a coffee machine. Hires a cleaner. Makes a presentation. | **Room 3.** Staff take coffee breaks. |
| 16 to 19.5 | Day 5 | Writes the Equipment Call application. | PI nags politely. Deadline is Day 5, 17:00 (minute 19.6). Award: 2,000. **Grant deadline survived.** |
| 20 to 22 | Day 6 | Builds the Media Facility. Signs the logbook. | **Room 4 and facility.** Inspector Tock visits. Checklist complete: the Lab Warming Party plays. |
| 22 to 30 | Days 6 to 8 | Free play. Upgrades the bench and hood. Writes paper 3. Looks at the Foundation Grant. | Visitors buy media. "Slides by tonight" PI event. Feedback prompt at minute 30. |

The plan reaches every v1 goal by about minute 22. That leaves 8 minutes of slack for a slower first-time player.

### 2.4 The v1 goal checklist (shown in game as the "Lab Warming list")

1. Own 4 rooms.
2. Hire 2 different kinds of staff.
3. Open 1 facility.
4. Get through 1 request from Prof. Quince.
5. Get 1 grant in before its deadline.

When all five are ticked, the Lab Warming Party plays (cake, confetti, a group photo card) and the game continues in free play.

---

## 3. Controls

The game is played on a laptop with keyboard and mouse or trackpad. Every action is reachable by mouse alone. Keys are shortcuts.

### 3.1 Walk mode (default)

| Input | Action |
|---|---|
| WASD or arrow keys | Walk one tile at a time. Hold to keep walking. |
| Left click on a floor tile | Walk there by the shortest path. |
| Left click on a station | Walk to it and start its default job. |
| E or Space | Use the station you are facing. Press again during the job for the sweet-spot bonus (section 4.4). |
| Esc | Stop the current job. Close the open panel. |
| B | Toggle build mode. |
| Tab | Open the management panel (Staff, Grants, Orders, Lab Warming list). |
| M | Open the inbox. |
| F | Open the feedback note box. |
| P | Pause or resume. |
| 1 and 2 | Set speed to 1x or 2x. |

When a text field has focus, all game keys are ignored.

### 3.2 Build mode

Build mode pauses the simulation and shows the tile grid. A side panel lists Rooms, Equipment and Decor.

| Input | Action |
|---|---|
| Click an empty plot | Shows the room types you can buy for it. Click one to buy. |
| Click a catalogue item | Picks it up. A ghost follows the cursor. Green means valid. Red means invalid, with a one-line reason. |
| Left click | Place. |
| R or right click | Rotate the held item 90 degrees. |
| Click placed equipment | Opens a small menu: Move (free), Upgrade, Repair, Sell (50% refund). |
| Esc or B | Drop the held item, then leave build mode. |

Placement rules: the footprint must be on free floor tiles inside a room that allows the item. The item's use tile (the tile in front of it) must be free floor and reachable from the room door. Door tiles and the tile inside each door stay clear.

---

## 4. v1 content

All numbers in this section live in data tables under `src/content/`. Times are real seconds at 1x speed. Money has no currency symbol in game, only a coin icon.

### 4.1 The building and its rooms

v1 uses a fixed floor plan. One corridor runs left to right. Three room plots sit above it and three below. The player buys a plot and chooses its room type. Equipment is placed freely inside. Free-form room drawing is post-v1.

The map is 30 by 20 tiles. Legend: `#` wall, `D` door, `=` corridor, `E` entrance, `.` outside, letters are plot interiors (8 by 6 tiles each).

```
..............................   row 0
.############################.   row 1
.#aaaaaaaa#bbbbbbbb#cccccccc#.   rows 2 to 7
.####D########D########D#####.   row 8
.E==========================#.   rows 9 to 10
.####D########D########D#####.   row 11
.#dddddddd#eeeeeeee#ffffffff#.   rows 12 to 17
.############################.   row 18
..............................   row 19
```

- Plot `a` is the starting Lab. Plots `b` to `f` are for sale.
- The delivery bay is the corridor tile at (2, 9). The waste point is at (2, 10). Both are walkable floor markers.
- Visitors, couriers and new staff enter at `E`.

| Room type | Cost | Unlock | Allows | Notes |
|---|---|---|---|---|
| Lab | start, then 600 | none | Bench, hood, incubator, sink, desk, fridge, shelf, bin | The player starts with one. |
| Wash-up Room | 400 | none | Sink, autoclave, shelf, bin | Unlocks wash-up crew. |
| Break Room | 300 | none | Coffee machine, sofa, fridge, plant | Staff breaks here are faster. |
| Office | 350 | Reputation 20 | Desk, shelf, plant | Desks here write 25% faster. Optional in v1. |
| Media Facility | 800 | Reputation 30 | Media prep unit, fridge, shelf, bin | The v1 facility. See 4.6. |

Every room comes with a free spray station by the door. Every room has a Cleanliness value from 0 to 100. It starts at 100 and drops by 2 for each job finished in the room.

Starting Lab layout (tile coordinates, all facing into the room): hood at (2,2) to (3,2). Bench at (5,2) to (6,2). Incubator at (8,2). Broken fridge at (9,2). Shelf at (9,4). Sink at (2,7). Waste bin at (3,7). Spray station at (6,7). Desk at (8,7) to (9,7). The door is at (5,8).

### 4.2 Equipment and upgrade tiers

Upgrade prices are the price to go from the previous tier. Tier 3 exists only where listed.

| Equipment | Size | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|---|
| Bench | 2x1 | 200. Experiment takes 15 s, gives 10 Data. | +300. 12 s, 14 Data. | +700, Reputation 60. 10 s, 20 Data. |
| Hood | 2x1 | 250. Split takes 10 s. | +350. 7 s. Contamination chance halved. | none |
| Incubator | 1x1 | 150. 2 culture slots. Growth 45 s. | +250. 4 slots. | +500, Reputation 60. 8 slots. Growth 35 s. |
| Fridge | 1x1 | Starts broken: cold capacity 8, can spoil media. Repair 150: capacity 16. A new fridge costs 200. | +300. Capacity 32. | none |
| Shelf | 2x1 | 80. Dry capacity 12. | +150. Capacity 24. | none |
| Sink | 1x1 | 100. 5 s per flask. | +150. 3 s per flask. | none |
| Waste bin | 1x1 | 40. Holds 8 waste. | +80. Holds 16. | none |
| Desk | 2x1 | 120. Writing speed 1.0. | +200. Writing speed 1.25. | none |
| Autoclave | 2x1 | 300. 8 flasks per cycle. 6 s to load, 40 s unattended. 5% breakdown chance per cycle. | +400. 16 flasks, 30 s, never breaks. | none |
| Coffee machine | 1x1 | 150. Staff break takes 20 s (40 s without one). | +250. Break takes 12 s. Mood +10. | none |
| Sofa | 2x1 | 100. Mood +10. | none | none |
| Plant | 1x1 | 30. Mood +2 each, up to 3 plants. | none | none |
| Media prep unit | 3x1 | 400. 1 bottle per 15 s. 6 bottles per powder. | +500. 1 bottle per 8 s. 8 bottles per powder. | none |
| Spray station | 1x1 | Free with each room. | none | none |

### 4.3 Items and stock

Stock is building-wide in v1. Nobody carries flasks between rooms. Only delivery boxes and waste bags are carried by hand. This keeps logistics simple and keeps the pace gentle.

| Item | Storage | How you get it | Used by |
|---|---|---|---|
| Clean flask | Dry | Wash a dirty flask. Buy a box. | Split cells |
| Dirty flask | Piles by the sink, no limit | Run experiment, bin a culture | Wash flasks, autoclave |
| Media bottle | Cold | Make media. Media Facility. | Split cells |
| Assay kit | Cold | Order | Run experiment |
| Media powder | Dry | Order | Make media |
| Culture | Incubator slot | Split cells | Run experiment |
| Waste | Room waste bin | Run experiment, bin a culture | Take out waste |
| Delivery box | Delivery bay | Order arrives | Put away order |

Orders are placed at any desk. Delivery takes 30 s.

| Order | Price | Contents |
|---|---|---|
| Assay kit box | 40 | 4 assay kits |
| Media powder box | 30 | 4 media powder |
| Flask box | 30 | 6 clean flasks |

If storage is full, the box waits at the delivery bay. Nothing is ever lost for lack of space.

### 4.4 Stations and hand-jobs

A hand-job is one key press and a progress bar. Walking away pauses the job and keeps its progress. There is one optional flourish: a marker sweeps along the bar once, and pressing E while it is in the green zone gives a small bonus. Missing it costs nothing. No job has a fail result.

| Job | Station | Needs | Time | Result | Sweet-spot bonus | Who can do it |
|---|---|---|---|---|---|---|
| Split cells | Hood | 1 clean flask, 1 media, 1 free incubator slot | 10 s | 1 culture, ready after 45 s | Culture grows 10 s faster | Player, technician |
| Run experiment | Bench | 1 ready culture, 1 assay kit, bin not full | 15 s | 10 Data, 1 dirty flask, 1 waste | +2 Data | Player, technician |
| Make media | Bench | 1 media powder, cold space | 12 s | 3 media | +1 media | Player, technician |
| Wash flask | Sink | 1 dirty flask | 5 s | 1 clean flask | Next flask takes half the time | Player, wash-up crew |
| Run autoclave | Autoclave | Dirty flasks | 6 s, then 40 s unattended | Up to 8 clean flasks | none | Player, wash-up crew |
| Put away order | Delivery bay, then fridge or shelf | 1 box, storage space | 6 s plus the walk | Stock added | none | Player, wash-up crew, technician |
| Take out waste | Waste bin, then waste point | Bin not empty | 4 s plus the walk | Bin emptied | none | Player, cleaner |
| Tidy up | Spray station | Cleanliness below 80 | 8 s | Cleanliness +40 | +10 Cleanliness | Player, cleaner |
| Bin a culture | Incubator | 1 contaminated culture | 3 s | 1 dirty flask, 1 waste | none | Player, technician |
| Write paper | Desk | 50 Data | 20 s | Paper goes to review for 40 s | none | Player |
| Revise paper | Desk | 10 Data | 8 s | Paper accepted | none | Player |
| Make presentation | Desk | 20 Data | 12 s | +8 Reputation | none | Player |
| Write grant | Desk | The grant's requirements | 20 s | Application sent. Decision after 30 s. | none | Player |
| Sign logbook | Desk | An inspection is announced | 5 s | One inspection check passes | none | Player |
| Coax autoclave | Autoclave | Autoclave is broken | 8 s | 50% chance it works again | none | Player |
| Coffee break | Coffee machine | none | 20 s | Player gets +10% job speed for 60 s | none | Player, all staff |

Writing jobs belong to the player in v1. The player is the scientist. Staff keep the lab running.

### 4.5 Staff

| Role | Unlock | Hire fee | Salary per day | Speed | Job priority, first to last |
|---|---|---|---|---|---|
| Technician | Reputation 10 | 200 | 60 | 0.8 | Bin a culture, run experiment, split cells, make media, put away order |
| Wash-up crew | Own a Wash-up Room | 120 | 35 | 1.0 | Run autoclave, wash flask, put away order |
| Cleaner | Own 2 rooms | 100 | 30 | 1.0 | Take out waste, tidy up |
| Media technician | Comes with the Media Facility | 0 | 50 | 1.0 | Run the media prep unit, serve visitors |

- v1 allows up to 2 of each hireable role.
- The hire panel shows 3 candidates per role. Each has a name, a portrait colour and one trait. Candidates refresh each morning.
- Speed 0.8 means a job takes 1.25 times as long as it does for the player.

**Needs.** Staff have two needs. There are no others in v1.

- **Energy** runs from 0 to 100. It drops by 1 for every 4 s of work. At 20 or below, the person finishes the current job and takes a break. A break restores Energy to 100.
- **Mood** runs from 0 to 100 and is recalculated every 10 s. Base 60. +10 if a coffee machine exists. +10 if a sofa exists. +2 per plant, up to 3. +10 if their current room has Cleanliness of 70 or more. -10 if it is below 40. -10 if any waste bin is full. -5 while a PI request is active. +20 for 60 s after cake. Job speed is multiplied by 0.9 at Mood 0 and by 1.1 at Mood 100, linear between.
- Staff never quit in v1. A low Mood shows a small rain cloud over their head. That is all.

**Traits.** Each candidate has one.

| Trait | Effect |
|---|---|
| Golden Hands | Cultures they split have half the contamination chance. |
| Labels Everything | Puts away orders 30% faster. |
| Coffee Powered | Works 15% faster. Energy drains 50% faster. |
| Hums While Pipetting | Everyone else in the same room gets +5 Mood. |
| Early Bird | 15% faster before 12:00. 5% slower after. |
| Tidy | Their jobs do not reduce Cleanliness. |
| Chatty | Breaks take 50% longer. Everyone gets +5 Mood while they are on break. |
| Has Seen Things | Ignores all Mood penalties. Twenty years in the same lab. |

Staff name pool (original, mix freely): Ansel, Birgit, Caspian, Dorrie, Emre, Fenna, Gus, Hanneke, Ilse, Jory, Kasimir, Lotte, Milo, Nour, Odile, Pim, Runa, Sorrel, Tavi, Wren.

### 4.6 The v1 facility: the Media Facility

Nickname in game: "the Media Kitchen".

- Requires Reputation 30. The room costs 800. It needs one media prep unit (400) to open.
- A media technician arrives with it. Salary 50 per day.
- While media powder is in stock and media is below the target level, the unit makes 1 bottle every 15 s. One powder makes 6 bottles here, against 3 by hand.
- The target level is a slider in the room panel. Default 8.
- An **auto-reorder** toggle appears. When on, a media powder box is ordered whenever powder stock drops below 2.
- **Visitors.** Every 60 to 90 s a researcher from a neighbouring lab walks in. If media stock is above the reserve of 4, they take 2 bottles and pay 15 each. Then they walk out. Sometimes they say something ("Do you have any without phenol red? No? Fine.").
- Net effect: the player never has to make media again, and the facility roughly pays for its own technician.

### 4.7 Contamination and cleanliness

- When a culture finishes growing, it rolls for contamination. Base chance 5%.
- +5% if the Lab's Cleanliness is below 50. Halved by a tier 2 hood. Halved by Golden Hands.
- Never on the first 6 cultures of a save. Never twice in a row.
- A contaminated culture shows green fuzz. It must be binned (3 s). The flask comes back dirty. No other cost.

---

## 5. Economy

### 5.1 Currencies

| Currency | What it is | Earned by | Spent on |
|---|---|---|---|
| Funds | Money | Grants, publication bonuses, daily core funding, PI rewards, media sales | Rooms, equipment, upgrades, hires, salaries, orders |
| Data | Raw results | Experiments | Papers (50), presentations (20), revisions (10) |
| Papers | A count of accepted papers | Writing and review | Never spent. Required by grants. |
| Reputation | Standing of the lab | Papers, presentations, grants, PI events, inspections | Never spent. Unlocks staff, rooms, tier 3 and grants. |

### 5.2 Starting state

- Funds 500. Data 0. Reputation 0. Papers 0.
- Stock: 6 clean flasks, 3 media, 4 assay kits, 1 media powder.
- Cold storage is 7 of 8 full. This is on purpose. It leads the player to the fridge repair.

### 5.3 Income and reputation

| Source | Funds | Reputation |
|---|---|---|
| Core funding, each day at 18:00 | +100 | 0 |
| Paper accepted | +250 | +10 |
| Presentation | 0 | +8 |
| PI request completed | +150 to +200 (see events) | +5 |
| PI request missed | +50 | 0 |
| Grant awarded | See 5.4 | +5 |
| Inspection, per check passed | +50 | +2 |
| Inspection, all checks passed | 0 | +5 extra |
| Media sold to a visitor | +15 per bottle | 0 |

Salaries are paid at 18:00. If Funds would go below zero, the balance goes negative down to -500. The card reads: "Covered from Prof. Quince's discretionary account. She will mention it." While Funds are negative the player cannot buy rooms or equipment, but orders still work. Nobody leaves. Nothing closes.

### 5.4 Grants

| Grant | Requires | Pays | Announced | Deadline |
|---|---|---|---|---|
| Seedling Grant | 1 paper | 1,200 | Day 1 | none |
| Departmental Equipment Call | 2 papers, 1 presentation | 2,000 | Day 3, 09:00 | Day 5, 17:00 |
| Foundation Project Grant | 4 papers, Reputation 60 | 4,000 | Day 6, 09:00 | Day 10, 17:00 |

Rules for deadlines:

- A countdown chip sits in the top bar from the announcement.
- If the deadline passes without an application, the portal "crashes" and the deadline moves one day. The payout drops to 80%. This repeats once per day. A grant can never be lost.
- An application sent before any current deadline counts for the checklist.
- Every application succeeds in v1. The decision takes 30 s and arrives as an email.

### 5.5 Papers and Reviewer 2

- Paper 1 is always accepted outright.
- Paper 2 always comes back with a minor revision. This is the scripted first meeting with Reviewer 2.
- From paper 3 on: 60% accepted, 40% minor revision.
- A revision costs 10 Data and 8 s at the desk. It is then always accepted. Papers are never rejected in v1.

### 5.6 Pacing table

Expected state for an average first-time player at 1x speed. Funds are after the listed actions.

| Min | Day | Key actions | Funds | Data made in total | Papers | Reputation | Rooms | Staff types |
|---|---|---|---|---|---|---|---|---|
| 0 | 1 | Start | 500 | 0 | 0 | 0 | 1 | 0 |
| 3 | 1 | Repair fridge -150. Order kits -40. | 310 | 20 | 0 | 0 | 1 | 0 |
| 4 | 1 | Day end +100 | 410 | 30 | 0 | 0 | 1 | 0 |
| 8 | 2 | Orders -70. PI request done +200. Day end +100. | 640 | 60 | 0 | 5 | 1 | 0 |
| 9 | 3 | Paper 1 accepted +250 | 890 | 70 | 1 | 15 | 1 | 0 |
| 10 | 3 | Seedling Grant +1,200 | 2,090 | 80 | 1 | 20 | 1 | 0 |
| 12 | 3 | Wash-up Room -400. Autoclave -300. Wash-up hire -120. Technician -200. Orders -70. Day end +100, salaries -95. | 1,005 | 100 | 1 | 20 | 2 | 2 |
| 15 | 4 | Incubator tier 2 -250. Paper 2 accepted +250. Presentation. | 1,005 | 160 | 2 | 38 | 2 | 2 |
| 16 | 4 | Break Room -300. Coffee -150. Cleaner -100. Orders -70. Day end +100, salaries -125. | 360 | 180 | 2 | 38 | 3 | 3 |
| 19 | 5 | Equipment Call awarded +2,000 | 2,360 | 240 | 2 | 43 | 3 | 3 |
| 20 | 5 | Day end +100, salaries -125 | 2,335 | 260 | 2 | 43 | 3 | 3 |
| 22 | 6 | Media Facility -800. Prep unit -400. Inspection passed +200. | 1,335 | 300 | 2 | 56 | 4 | 4 |
| 30 | 8 | Bench and hood tier 2 -650. Paper 3 +250. Two day ends. Media sales. | about 1,000 | 480 | 3 | 66 | 4 | 4 |

Throughput assumptions behind the table: the player alone runs about 1 experiment per minute, including upkeep and walking. A technician adds about 1 more. Two incubator slots cap the lab at about 2 per minute, which is why the incubator upgrade is the first one suggested.

Total income by minute 20 is about 4,800. Required spending for the checklist is about 3,400. The 1,400 gap is the safety margin for slower players.

---

## 6. Characters and events

### 6.1 Cast

**Prof. Dr. Wilhelmina Quince, the PI.** Brilliant, warm and never in the building. She emails from airports, trains and conference dinners. Every email is signed "Best, W" and ends "Sent from my phone". She believes every experiment takes one afternoon. She calls the lab "the team" even when the team is one person. She cannot remember which cell line you use. She does remember your birthday, and she turns up with cake whenever a grant comes in. She is never cruel. Her expectations are impossible because she thinks you are that good.

**Reviewer 2.** Never seen. Communicates only through review letters. Always has one more request. Has strong feelings about citations.

**Inspector Pernille Tock.** The gene-technology and biosafety inspector. Carries a clipboard. Very fair. Awards gold star stickers and means it.

**Bodo, the courier.** Delivers boxes to the delivery bay. Usually the right ones.

### 6.2 How events work

- Events arrive as emails in the inbox, with a soft ping. Some put a request chip in the top bar.
- An event director in the sim fires scripted beats at fixed game times in the first week (see 6.5). After that it draws from the random pool.
- Random events: at most one every 90 s. No failure events in the first 6 minutes of a save. No two failures within 120 s. Only one PI request can be active at a time.
- Every event is a row in `src/content/events.ts` with an id, trigger, text, options and effects. No event logic is hard-coded.

### 6.3 Event list

**PI events**

| Id | Trigger | Text | Effect |
|---|---|---|---|
| `pi_welcome` | Day 1, 08:00 | "Welcome to the team! The lab is small but it has character. The fridge has the most character. Do great things. Best, W. Sent from my phone." | Starts the to-do list. |
| `pi_quick_one` | Day 2, 09:00. Later: random. | "Quick idea from the airport. Could you run three little experiments before lab meeting? Should only take an afternoon. Best, W." | Request: 3 experiments within 1.5 days. Done: +200, +5 Reputation. Missed: "No worries, we will call it preliminary." +50. |
| `pi_new_direction` | Random, after paper 1 | "I had a thought in the shower. What if we did all of it again, but in a different cell line?" | Request: 2 splits and 2 experiments within 2 days. Done: +30 Data, +5 Reputation. Missed: "I have had a better idea anyway." +50. |
| `pi_one_more_panel` | Random, when Data is 30 or more and no paper is in review | "Figure 3 looks lonely. One more panel?" | Choice. Yes: the next paper costs 60 Data and gives +15 Reputation instead of +10. No: nothing. She replies "Brave!". |
| `pi_slides_tonight` | Day 6, 14:00. Later: random after 14:00. | "I am presenting your data tomorrow. Do we have slides? We need slides." | Request: 1 presentation by 18:00 the next day. Done: +150 and +5 Reputation on top of the usual +8. Missed: "I will draw it on the whiteboard." +50. |
| `pi_cake` | 20 s after any grant award | "Cake in the corridor. I said we would get it. I always said that." | Quince walks in with cake. All staff get full Energy and +20 Mood for 60 s. |
| `pi_walkthrough` | Random, Reputation 20 or more | "I am showing a very important collaborator around at 3. Please look busy." | Quince and a visitor walk through the Lab. Cleanliness 60 or more: +3 Reputation. Below 60: "Charmingly lived-in." No penalty. |
| `pi_what_project` | Random | "Remind me, which project are you on again?" | Choice of two answers: "The one in your last three emails" or "The good one". Either gives +1 Reputation. |

**Failures**

| Id | Trigger | Text | Effect |
|---|---|---|---|
| `fail_fridge_warm` | Day 1, 13:00, then at most once a day while the fridge is broken | "The fridge is warm again. One bottle of media has gone cloudy. It is looking at you." | Lose 1 media. Stops for good when the fridge is repaired. |
| `fail_contamination` | Contamination roll. Scripted on Day 4, 10:00 if none has happened. | "Something is growing in flask 2. It is not your cells. It seems happy." | One culture is contaminated. Bin it. |
| `fail_autoclave` | 5% per tier 1 cycle, never in its first 3 cycles | "The autoclave has made a noise. Then a different noise. Now it is silent, which is worse." | Autoclave is out of service. Coax it (50% chance) or call the engineer from a desk. The engineer arrives in 30 s and fixes it. First call is free, later calls cost 50. The sink still works. |
| `fail_lost_order` | 8% per order, after the 4th order of a save | "Your order has been delivered. To a building. The tracking page is confident it is a building." | The box appears on a random corridor tile with a question mark over it. Walk to it and pick it up. |
| `fail_substitution` | 5% per assay kit order | "They were out of assay kits. They sent 500 boxes of pipette tips instead. The kits follow shortly." | Kits arrive 30 s late. The player keeps 2 free clean flasks from the apology parcel. |
| `fail_door_open` | Random, 2 or more cultures growing | "Someone left the incubator door open. The log says it was you." | Growing cultures take 15 s longer. |
| `fail_mystery_tube` | Random | "You find a tube in the fridge. The label says '2'. Nothing else." | Choice. Keep: 50% chance of +5 Data ("It was the missing control"), else nothing. Bin: +1 waste and a clear conscience. |
| `fail_bin_full` | A waste bin reaches capacity | "The waste bin is now a monument. Experiments in this room are paused until someone takes it out." | Experiments in that room pause until the bin is emptied. |
| `fail_update` | Random | "The bench computer wants to install updates. 1 of 47." | One bench is unavailable for 20 s. |

**Admin, inspections and deadlines**

| Id | Trigger | Text | Effect |
|---|---|---|---|
| `insp_notice` | Day 5, 13:00. Later: every 8 days. | "Routine gene-technology inspection tomorrow at 11:00. Please have your logbook signed, your waste in order and your surfaces wiped. Kind regards, P. Tock." | Unlocks the Sign logbook job. Shows a 4-item checklist. |
| `insp_visit` | The day after the notice, 11:00 | Per check passed: "Tock nods. A sticker is applied." Per check missed: "Tock writes for quite a long time." | Tock walks to each room. Checks: logbook signed, no bin full, every room at Cleanliness 60 or more, no broken fridge. Each pass: +50, +2 Reputation. All four: +5 Reputation and a gold star on the lab door. Each miss leaves a sticky note to fix. No fine. |
| `admin_waste_rules` | Day 7, 09:00. Later: random. | "Facilities has introduced a new bin colour. Nobody knows what goes in it. Please use it correctly." | Taking out waste takes 3 s longer until 18:00. Then: "The memo has been withdrawn." |
| `admin_fire_test` | Day 7, 14:00. Later: random. | "This is a test of the fire alarm. It is always a test." | Staff walk to the entrance and stand outside for 15 s holding ice buckets. Mood +5 for everyone. Running jobs keep their progress. |
| `admin_seminar_pizza` | Random | "Seminar in room 3. There is pizza. The seminar is optional. The pizza is not." | All staff get full Energy. |
| `grant_announce` | Per the grants table | "A call is open: the Departmental Equipment Call. Two papers and a presentation. You have until Day 5. Plenty of time! Best, W." | Adds the deadline chip. |
| `grant_nag` | 09:00 on each of the last 2 days before a deadline | "How is the application? No pressure. I have told the Dean it is basically submitted." | Flavour only. |
| `grant_portal_crash` | Deadline passes with no application | "The submission portal is 'experiencing high demand'. The deadline has moved to tomorrow. So has everyone's weekend." | Deadline +1 day. Payout 80%. |
| `grant_award` | 30 s after an application | "We are pleased to inform you. (The rest of the email is three pages about reporting duties.)" | Funds and +5 Reputation. Triggers `pi_cake`. |

That is 26 events for v1.

### 6.4 Reviewer 2 lines

One line is drawn at random for each review letter. Lines 1 and 2 are fixed.

1. Paper 1, accepted: "Reviewer 2 was on holiday. Accepted as is. Frame this email."
2. Paper 2, minor revision: "Reviewer 1: accept. Reviewer 3: accept. Reviewer 2: four pages."
3. "Reviewer 2 asks whether you have considered citing the work of Reviewer 2."
4. "Reviewer 2 finds the manuscript broadly fine and requests eleven further experiments. The editor has reduced this to one."
5. "Reviewer 2 would like the Western blots repeated. The paper contains no Western blots."
6. "Reviewer 2 feels the title is too interesting."
7. "Reviewer 2 asks what happens in vivo. Reviewer 2 always asks what happens in vivo."
8. "Reviewer 2 suggests the text be checked by a fluent speaker. It was written by three."
9. "Reviewer 2 has no further comments. Reviewer 2 has attached further comments."
10. Any acceptance after a revision: "Reviewer 2 is 'satisfied'. The quotation marks are theirs."

### 6.5 Scripted beats for the first week

| Game time | Real minute | Beat |
|---|---|---|
| Day 1, 08:00 | 0 | `pi_welcome` |
| Day 1, 13:00 | 2 | `fail_fridge_warm` |
| Day 2, 09:00 | 4.4 | `pi_quick_one` |
| Day 3, 09:00 | 8.4 | `grant_announce` for the Equipment Call |
| Day 4, 09:00 | 12.4 | `grant_nag` |
| Day 4, 10:00 | 12.8 | `fail_contamination`, if none yet |
| Day 5, 09:00 | 16.4 | `grant_nag` |
| Day 5, 13:00 | 18 | `insp_notice` |
| Day 5, 17:00 | 19.6 | Equipment Call deadline |
| Day 6, 09:00 | 20.4 | `grant_announce` for the Foundation Grant |
| Day 6, 11:00 | 21.2 | `insp_visit` |
| Day 6, 14:00 | 22.4 | `pi_slides_tonight` |
| Day 7, 09:00 | 24.4 | `admin_waste_rules` |
| Day 7, 14:00 | 26.4 | `admin_fire_test` |

---

## 7. Art direction

### 7.1 Format

- Internal game resolution: 480 by 270 pixels. Scaled to fit the window with nearest-neighbour filtering. It is 960 by 540 at 2x and 1440 by 810 at 3x.
- Tile size: 16 by 16. Characters: 16 wide by 24 tall, drawn with their feet on their tile.
- View: top-down with a slight three-quarter tilt. You see the front face and the top of furniture.
- The 30 by 20 map is 480 by 320 pixels. The camera follows the player and scrolls vertically only.
- Characters have 4 facing directions, 2 walk frames each, and 1 "working" frame. That is 9 frames per character.
- All menus and text are HTML over the canvas, at full screen resolution. Text stays crisp. Pixel art stays in the world.

### 7.2 Palette

Warm, soft, slightly dusty. No pure black. No pure white. Outlines use the plum shadow colour. All sprites use only these 16 colours, defined once in `src/view/art/palette.ts`.

| Name | Hex | Use |
|---|---|---|
| Plum shadow | `#4A3540` | Outlines, darkest shade |
| Cocoa | `#7A5548` | Wood shade, hair |
| Warm wood | `#C68B59` | Benches, desks, shelves |
| Terracotta | `#D9734E` | Accents, alerts, PI scarf |
| Mustard | `#E8B04A` | Coins, highlights, sticky notes |
| Butter | `#F6D98B` | Light, warm glow |
| Cream | `#F3E3C3` | Floors |
| Paper | `#FFF6E5` | Lab coats, paper, lightest shade |
| Sage | `#8FB996` | Plants, valid placement, cleaner uniform |
| Moss | `#5E8C6A` | Plant shade, contamination fuzz |
| Teal | `#4E8C8A` | Lab equipment metal, wash-up uniform |
| Sky | `#A7D3D8` | Glass, water, hood sash |
| Dusty rose | `#D98C8C` | Media (phenol red), invalid placement |
| Berry | `#A8516E` | Technician uniform, biohazard bags |
| Stone | `#B8A99A` | Walls, corridor floor |
| Slate | `#6E6A78` | Machines, autoclave, shade for metal |

### 7.3 Sprite list for v1

| Group | Sprites |
|---|---|
| Tiles | Lab floor, corridor floor, break room floor, wall top, wall face, door closed, door open, outside grass, plot-for-sale overlay, delivery bay marker, waste point marker |
| Equipment | Bench T1 to T3. Hood T1, T2. Incubator T1 to T3. Fridge broken, T1, T2. Shelf T1, T2. Sink T1, T2. Waste bin T1, T2, each with a full state. Desk T1, T2. Autoclave T1, T2, with a broken state. Coffee machine T1, T2. Sofa. Plant. Media prep unit T1, T2. Spray station. |
| Characters | Player (2 looks), technician, wash-up crew, cleaner, media technician, Prof. Quince, Inspector Tock, Bodo the courier, visitor (2 looks). Staff sprites are tinted for variety. |
| Item icons (16x16) | Clean flask, dirty flask, media bottle, assay kit, media powder, culture, contaminated culture, waste bag, delivery box, Data, paper, coin, Reputation star |
| Effects | Sparkle, steam, green fuzz, zzz, heart, exclamation mark, question mark, rain cloud, confetti, gold star, cake |
| UI icons (16x16) | Build, inbox, staff, grants, orders, pause, 1x, 2x, feedback, save, mute |

### 7.4 Placeholder strategy

Art comes in three stages. Each stage replaces the previous one through a single sprite registry. No game code changes.

1. **Stage A, coloured shapes (milestones 1 to 7).** At boot the view generates textures in code. Each entity is a rounded rectangle in its palette colour with a plum outline and a short text label ("HOOD", "TECH"). Characters are a body rectangle with a head circle and a facing dot.
2. **Stage B, pixel maps in code (milestone 8).** Each sprite is a small text grid in a TypeScript file. One character per pixel. Each character maps to a palette colour. At boot the view paints these onto canvas textures. An agent can author and revise these with no image tools. Because every sprite uses the same palette file, the style stays consistent.
3. **Stage C, PNG atlas (post-v1, optional).** Hand-drawn or commissioned PNGs replace pixel maps one key at a time.

The registry is `src/view/art/spriteRegistry.ts`. It maps a sprite key such as `equip.hood.t1` to a source: `shape`, `pixelmap` or `file`.

Third-party art is not needed. If any is added later, it must be CC0 (public domain dedication). Record the source link and licence in `CREDITS.md`. Do not use assets that are non-commercial, share-alike or of unclear origin. Do not use fonts fetched from a remote server. The UI uses the system font stack: `ui-rounded, "Segoe UI", system-ui, sans-serif`.

---

## 8. Code architecture

### 8.1 Stack

- TypeScript in strict mode. Vite for dev server and build. Phaser 3, latest 3.x release, with the exact version pinned in `package.json`.
- Vitest for tests. ESLint for import rules. No UI framework. No other runtime dependencies.
- Node 22 for tooling.

### 8.2 Layers and the one rule

There are four layers. The rule: **`sim` and `content` never import from `view`, `ui`, `platform`, Phaser or the DOM.**

| Layer | Folder | Job | May import |
|---|---|---|---|
| Content | `src/content/` | Data tables. No logic. | Types from `sim/types` only |
| Sim | `src/sim/` | All game rules. Pure and deterministic. | `content` |
| View | `src/view/` | Phaser scenes. Draws state. Turns input into commands. | `sim` (read-only), `content` |
| UI | `src/ui/` | HTML panels over the canvas. | `sim` (read-only), `content` |
| Platform | `src/platform/` | localStorage, clipboard, file download, real-time clock. | nothing from the game |

Enforcement: an ESLint `no-restricted-imports` rule on `src/sim` and `src/content`. Also a separate `tsconfig.sim.json` that includes only those two folders and sets `lib` to `["ES2022"]` with no DOM types. `npm run typecheck:sim` fails if the sim touches `window`, `document` or `localStorage`. The sim never calls `Math.random` or `Date.now`.

### 8.3 Folder structure

```
labwarming/
  index.html
  package.json
  vite.config.ts            base: './'
  tsconfig.json
  tsconfig.sim.json
  .github/workflows/deploy.yml
  CREDITS.md
  CHANGELOG.md
  src/
    main.ts                 wires platform, sim, view and ui together
    content/
      balance.ts            global constants (tick rate, day length, start state)
      map.ts                the 30x20 tile map and plot definitions
      rooms.ts  equipment.ts  items.ts  jobs.ts
      staff.ts  traits.ts  names.ts
      grants.ts  events.ts  reviewer2.ts  beats.ts
      goals.ts  tutorial.ts
    sim/
      types.ts              GameState and all entity types
      createState.ts        createInitialState(seed)
      step.ts               step(state, commands) -> SimEvent[]
      commands.ts           Command union and validation
      simEvents.ts          SimEvent union
      rng.ts                seeded generator (mulberry32), state kept in GameState
      grid.ts               walkability, room lookup, placement checks
      pathfinding.ts        A* and path cache
      selectors.ts          read-only helpers for view and ui
      systems/
        clock.ts  movement.ts  jobs.ts  staffAi.ts  needs.ts
        production.ts  cultures.ts  orders.ts  cleanliness.ts
        papers.ts  grants.ts  economy.ts  director.ts  inspection.ts
        visitors.ts  goals.ts  tutorial.ts
      save/
        serialize.ts  migrate.ts  validate.ts
      bots/
        averageBot.ts  slowBot.ts      scripted players for balance tests
    view/
      game.ts               Phaser config
      scenes/BootScene.ts  LabScene.ts
      renderers/tileRenderer.ts  equipmentRenderer.ts  agentRenderer.ts  fxRenderer.ts  buildGhost.ts
      input/walkInput.ts  buildInput.ts
      art/palette.ts  spriteRegistry.ts  shapes.ts  pixelmaps/
      audio/sfx.ts
    ui/
      root.ts               mounts the overlay and scales it to the canvas
      topBar.ts  todoNote.ts  inbox.ts  managePanel.ts  buildPanel.ts
      stationMenu.ts  dayEndCard.ts  toast.ts  feedback.ts  settings.ts
      styles.css
    platform/
      storage.ts  clipboard.ts  download.ts  buildInfo.ts
  tests/
    sim/*.test.ts
    balance/pacing.test.ts
```

### 8.4 The sim API

The whole game is driven through three functions.

```ts
createInitialState(seed: number): GameState
step(state: GameState, commands: Command[]): SimEvent[]   // advances exactly one tick, mutates state
serialize(state: GameState): string  /  deserialize(text: string): GameState
```

- **Commands** are the only way to change state from outside. They are plain objects. Examples: `MovePlayer {dir}`, `SetPlayerTarget {x, y, stationId?}`, `Interact {stationId, jobId}`, `SweetSpotPress`, `CancelJob`, `SetSpeed`, `BuyPlot {plotId, roomType}`, `PlaceEquipment {defId, x, y, rot}`, `MoveEquipment`, `UpgradeEquipment`, `RepairEquipment`, `SellEquipment`, `HireStaff {candidateId}`, `PartWays {agentId}`, `PlaceOrder {itemId}`, `ApplyGrant {grantId}`, `ChooseEventOption {emailId, option}`, `SetAutoReorder`, `SetMediaTarget`, `MarkEmailRead`.
- Invalid commands are ignored and produce a `CommandRejected` event with a reason string for the UI.
- **SimEvents** are the event bus. `step` returns the events of that tick. `main.ts` passes them to a tiny typed emitter. View and UI subscribe. Examples: `JobStarted`, `JobCompleted`, `StockChanged`, `FundsChanged`, `EmailReceived`, `PaperReviewed`, `GrantAwarded`, `CultureContaminated`, `EquipmentBroke`, `AgentSpawned`, `AgentLeft`, `DayEnded`, `GoalCompleted`, `AllGoalsCompleted`, `Toast`.
- The sim never stores SimEvents. They are for presentation only: sounds, sparkles, toasts.

### 8.5 State shape

Everything is plain JSON data. No classes, no functions, no Maps or Sets, no references between objects. Entities refer to each other by id.

```ts
interface GameState {
  schemaVersion: number;
  seed: number;
  rngState: number;
  tick: number;                       // total ticks since the save began
  clock: { day: number; tickOfDay: number; speed: 0 | 1 | 2 };
  playerName: string;
  funds: number; data: number; reputation: number;
  papers: Paper[];                    // status: writing | review | revise | accepted
  presentations: number;
  grants: Record<string, GrantProgress>;
  stock: { cleanFlasks: number; dirtyFlasks: number; media: number; assayKits: number; mediaPowder: number };
  plots: Record<string, Plot>;        // owned, roomType, cleanliness
  equipment: Record<string, Equipment>;   // defId, tier, x, y, rot, broken, reservedBy, machine timers
  agents: Record<string, Agent>;      // kind, x, y, facing, path, moveProgress, jobId, energy, mood, trait
  jobs: Record<string, Job>;          // defId, stationId, workerId, progressTicks, sweetSpot
  cultures: Culture[];
  orders: Order[]; boxes: Box[];
  candidates: Candidate[];
  inbox: Email[];
  director: { firedBeats: string[]; cooldowns: Record<string, number>; requests: ActiveRequest[] };
  inspection: InspectionState | null;
  goals: Record<string, boolean>;
  tutorial: { step: number; done: boolean };
  flags: Record<string, boolean | number>;
  stats: { experiments: number; cultures: number; ordersPlaced: number; autoclaveCycles: number };
  nextId: number;
}
```

Settings (volume, chosen look) and feedback notes are stored outside `GameState`.

### 8.6 Tick and time model

- The sim runs at a fixed 10 ticks per second. One tick is 100 ms of game time. One game day is 2,400 ticks.
- Content tables give durations in seconds. A helper converts them to ticks. Money and stock are integers.
- The view keeps an accumulator. Each frame it adds real elapsed time multiplied by the speed. It calls `step` once per 100 ms accumulated, up to 5 ticks per frame. It drops the excess if the tab was asleep.
- The view interpolates character positions between ticks so movement looks smooth.
- Movement is tile-based. Each agent has an integer `moveProgress`. Each tick it adds the agent's speed (player 40, staff 30). At 100 the agent steps to the next tile. So the player walks 4 tiles per second and staff walk 3.
- Systems run in a fixed order every tick: commands, clock, director, orders, cultures, machines, staffAi, movement, jobs, needs, cleanliness, papers, grants, visitors, inspection, economy, goals, tutorial.
- Same seed plus same commands on the same ticks gives the same state. A test checks this.

### 8.7 Jobs, staff AI and pathfinding

- **Job availability.** A job is available at a station when its inputs exist, its outputs have room, and the station is not reserved. The sim rebuilds the list of available jobs every 5 ticks.
- **Staff AI.** An idle staff member picks the first available job in their role's priority list. Ties go to the nearest station by path length. They reserve the station, walk to its use tile, face it and work. A reservation is released when the job ends or the agent is interrupted.
- **The player** uses the same job system. The player can take over a station that a staff member is walking to. The staff member simply picks another job.
- **Pathfinding.** A* on the 30 by 20 tile grid with 4-way movement. Walls and equipment block. Agents do not block each other. They pass through one another. This removes traffic jams and deadlocks.
- **Path cache.** Paths are cached by start and goal tile. The cache is cleared whenever the grid version number changes, which happens on any build action.
- **Unreachable stations** are skipped by staff and shown with a small "no path" icon in build mode.

### 8.8 View and UI

- One Phaser scene, `LabScene`, draws tiles, equipment, agents and effects from `GameState` each frame. It keeps a map from entity id to sprite. It creates and destroys sprites as entities appear and disappear.
- Phaser config: `pixelArt: true`, 480 by 270, scale mode FIT, centred.
- The UI is a `div` positioned over the canvas. `ui/root.ts` resizes it to match the canvas bounds. Panels re-render on relevant SimEvents and on a 4 times per second refresh for counters.
- Input handlers never change state. They only queue commands for the next tick.

---

## 9. Save system

- **Where.** `localStorage`, key `labwarming.save`. The previous save is copied to `labwarming.save.backup` before each write. One save slot in v1.
- **Format.** `{ "schemaVersion": 1, "savedAt": "<ISO time>", "build": "<git sha>", "state": { ... } }`. The real-time stamp is added by the platform layer, not the sim.
- **Autosave.** At every end-of-day card. Every 60 real seconds. When the tab is hidden (`visibilitychange`). After any purchase in build mode.
- **Load.** On start, if a save exists, the title screen offers Continue and New Game. New Game asks for confirmation and keeps the old save as the backup.
- **Versioning.** `sim/save/migrate.ts` holds an ordered list of functions, one per schema step (`1 -> 2`, `2 -> 3`). Loading runs every step from the save's version to the current one. Every change to `GameState` after milestone 3 must bump the version and add a migration with a test.
- **Validation.** After migration, `validate.ts` checks required fields and types. If the main save fails, the game tries the backup. If both fail, it offers Export Broken Save and New Game. It never deletes data silently.
- **Export.** Settings has "Copy save code" and "Download save file". The code is the JSON, base64 encoded, with the prefix `LABWARM1:`. The file is the same text as `labwarming-save.txt`.
- **Import.** Settings has "Load save code" with a paste box and a file picker. The game checks the prefix, decodes, migrates and validates before replacing the current save. The replaced save becomes the backup.
- **Storage failure.** All storage calls are wrapped in try and catch. If storage is unavailable (private window, blocked site data), a banner says: "Saving is off in this browser window. Use Copy save code before you close it."

---

## 10. Playtest feedback button

There is no backend. Notes stay in the player's browser until they send them to Dillon themselves.

- A speech-bubble button labelled "Note" sits in the top bar at all times. Shortcut: F.
- It opens a small box: a text area, three faces (like, meh, dislike), and Save. The game pauses while the box is open.
- Each note stores: text, face, real time, play time, game day and time, build id, Funds, Reputation, rooms owned, staff count, and the ids of the last 5 events. The context is added automatically.
- Notes are stored in `localStorage` under `labwarming.feedback`. This key is separate from the save. Starting a new game does not erase notes.
- Settings has a Feedback tab that lists all notes with three buttons:
  1. **Copy all notes.** Puts a plain-text report on the clipboard, ready to paste into a chat or email.
  2. **Download notes.** Saves `labwarming-feedback-<date>.txt`.
  3. **Email notes.** Opens a `mailto:` link with the report in the body, cut to 1,800 characters. This button only appears if `FEEDBACK_EMAIL` is set in `src/content/balance.ts`. It is empty by default.
- The game prompts gently twice: when the Lab Warming Party ends, and at 30 minutes of play time. The prompt reads: "Got a minute? Tell us one thing you liked and one thing you did not." It can be dismissed and never repeats.
- The report starts with a three-line summary: build id, total play time, and which checklist goals were reached at what play time. This tells Dillon whether the 30-minute target held.

---

## 11. Deploy path

The same static build works on both hosts. `vite.config.ts` sets `base: './'` so all asset paths are relative.

### 11.1 GitHub Pages (primary)

1. The repository is `Eomesodermin/labwarming` (see section 0). It is public, which a free account needs for Pages.
2. Add `.github/workflows/deploy.yml`. It runs on every push to `main` and on manual dispatch.
3. Workflow permissions: `contents: read`, `pages: write`, `id-token: write`.
4. Build job steps: `actions/checkout`. `actions/setup-node` with Node 22 and npm cache. `npm ci`. `npm run lint`. `npm run typecheck`. `npm test`. `npm run build`. `actions/upload-pages-artifact` with path `dist`.
5. Deploy job: `actions/deploy-pages`, with environment `github-pages`.
6. In the repository, open Settings, then Pages, and set Source to "GitHub Actions". This is a one-time manual step for Dillon.
7. The game is then live at `https://eomesodermin.github.io/labwarming/`. Share that link.
8. The build writes the short git commit id into the page (`platform/buildInfo.ts`). It shows in Settings and in feedback notes.

### 11.2 itch.io (optional, same build)

1. Run `npm run build`. Zip the contents of `dist` so that `index.html` is at the top level of the zip.
2. Create a new itch.io project. Kind of project: HTML.
3. Upload the zip. Tick "This file will be played in the browser".
4. Set the embed viewport to 960 by 540. Enable the fullscreen button.
5. Set visibility to Restricted or Draft and share the secret link.
6. Saves on itch.io live in that site's browser storage. They do not carry over from the GitHub Pages version. Use the save code to move between them.

---

## 12. Milestone build plan

### 12.1 Rules for every milestone

- Work in order. Do not start a milestone until the previous one passes its acceptance list.
- Every milestone ends with: `npm run lint`, `npm run typecheck`, `npm run typecheck:sim`, `npm test` and `npm run build` all passing, a deploy to the live link, and a line in `CHANGELOG.md`.
- All numbers come from `src/content/`. No balance number is typed into a system file.
- Placeholder shapes are fine until milestone 8.
- From milestone 3 on, a save made in the previous milestone must still load.
- If something in this doc turns out to be impossible, make the smallest change that works and record it in `CHANGELOG.md` under "Deviations".

### 12.2 Milestones

**Milestone 1: Walking skeleton**

| | |
|---|---|
| Scope | Project setup (Vite, TypeScript, Phaser, Vitest, ESLint with the import rule, both tsconfigs). The sim core: `GameState`, `createInitialState`, `step`, seeded RNG, clock, grid, movement, A* pathfinding. The 30 by 20 map from `content/map.ts` with the starting Lab open and other plots shown as "for sale". The player walks with keys and by clicking. Camera follow. Stage A shapes. The starting equipment is drawn but does nothing. Top bar with day and time, pause and speed. GitHub Actions deploy. |
| Acceptance | 1. The live link loads in under 5 seconds on a laptop and shows the lab. 2. WASD and arrow keys move the player one tile at a time. Holding a key keeps walking. 3. Clicking a floor tile walks the player there around obstacles. 4. The player cannot walk through walls or equipment and can walk through the door into the corridor. 5. The clock runs. P pauses. 2 doubles the speed. 6. Resizing the window keeps the picture sharp and centred. 7. Tests pass in CI, including a determinism test and pathfinding tests. |
| Skip | Jobs, stock, money, saving, sound, real art, the title screen. |

**Milestone 2: Stations and hand-jobs**

| | |
|---|---|
| Scope | The job system. Stock. Cultures and incubator slots. Hand-jobs: split cells, run experiment, make media, wash flask, take out waste, tidy up, bin a culture. Storage capacity for cold and dry. Cleanliness per room. Contamination rolls. The sweet-spot bonus. Progress bars over stations. A stock strip in the top bar. Station prompts ("E: Split cells") and a reason when a job is unavailable ("Needs 1 media"). The sticky-note to-do list for the first six steps. |
| Acceptance | 1. Facing the hood and pressing E starts a progress bar. A culture appears in the incubator when it ends. 2. After 45 s the culture shows as ready. 3. An experiment at the bench uses the culture and a kit and adds 10 Data. 4. The dirty flask can be washed at the sink and the clean count goes up. 5. Walking away mid-job pauses it. Coming back resumes it. 6. Pressing E in the green zone shows a "Nice!" and gives the bonus. 7. After 8 experiments with no waste run, the bench refuses with a clear message. 8. A new player can follow the to-do note to their first Data without other help. |
| Skip | Money, orders, papers, staff, build mode, emails. |

**Milestone 3: Money, orders, papers, saving and feedback**

| | |
|---|---|
| Scope | Funds, Reputation and the end-of-day card with core funding. Ordering at the desk, delivery boxes, put away order. Fridge repair through a station menu. The `fail_fridge_warm` event as a simple toast. Desk jobs: write paper, revise paper, make presentation. Review timer and Reviewer 2 letters shown in a basic inbox. The Seedling Grant. The whole save system from section 9 with a title screen. The feedback button from section 10. Settings panel. |
| Acceptance | 1. Ordering kits costs 40 and a box appears at the delivery bay after 30 s. 2. With the broken fridge full, the box cannot be put away and a message explains why. Repairing the fridge fixes it. 3. Writing a paper uses 50 Data. 40 s later a review email arrives. 4. The second paper comes back for revision. Revising costs 10 Data and it is then accepted. 5. The Seedling Grant can be applied for after paper 1 and pays 1,200. 6. Reloading the page and choosing Continue restores everything, including a half-finished job and the clock. 7. Copy save code, then New Game, then Load save code brings the old game back. 8. A feedback note can be written, survives a reload and a New Game, and appears in Copy all notes. 9. Typing "wasd" in the note box does not move the player. |
| Skip | Staff, build mode, PI events, other grants. |

**Milestone 4: Build mode, rooms and upgrades**

| | |
|---|---|
| Scope | Build mode with pause, grid overlay and side panel. Buying plots and choosing room types with unlock rules. Placing, rotating, moving, selling and upgrading equipment, with the placement rules from 3.2. All equipment and tiers from 4.2 working: autoclave cycle, storage tiers, incubator slots, bench and hood stats, coffee break for the player. Path cache invalidation. The "no path" warning. |
| Acceptance | 1. B pauses the game and shows the grid. 2. A plot can be bought as a Wash-up Room. Its door opens and the player can walk in. 3. An autoclave can only be placed in the Wash-up Room. Trying it in the Lab shows a red ghost and a reason. 4. Equipment cannot block a door or be placed with its front against a wall. 5. Moving the bench is free and the player can then use it in its new place. 6. Upgrading the incubator shows 4 slots and all 4 can be filled. 7. The autoclave takes dirty flasks, runs unattended and returns clean ones. 8. Selling returns half the price. 9. A save with a rearranged lab reloads correctly. |
| Skip | Staff, events, the Media Facility's function (the room type can be listed but locked). |

**Milestone 5: Staff**

| | |
|---|---|
| Scope | The hire panel with candidates, traits and salaries. Unlock rules for each role. Staff AI with role priorities and reservations. Energy, breaks, Mood and its modifiers. All 8 traits. Salaries on the end-of-day card and the negative-funds rule. A staff panel showing each person's current job, Energy and Mood. Mood and break icons over heads. The "Part ways" action. |
| Acceptance | 1. The technician cannot be hired before Reputation 10. The panel says why. 2. A hired technician walks in from the entrance and starts splitting cells and running experiments without being told. 3. Wash-up crew wash flasks and run the autoclave. A cleaner empties bins and tidies rooms. 4. With staff working and the player standing still for 3 minutes, Data still goes up and no bin stays full. 5. Staff take a coffee break when tired and come back. 6. The player can take a station that a staff member was walking to. The staff member picks another job. 7. Salaries appear on the end-of-day card. 8. Blocking a room's only path in build mode does not freeze anyone. Staff pick other jobs. |
| Skip | Events, visitors, the facility. |

**Milestone 6: Events, PI, grants with deadlines, inspection**

| | |
|---|---|
| Scope | The event director with scripted beats and the random pool. The full inbox with unread badge, choices and request chips. All PI events, failures and admin events from section 6. Prof. Quince, Inspector Tock and Bodo as walking characters. The Equipment Call and Foundation Grant with countdown, nags, portal crash and extension. The inspection flow. Cake. |
| Acceptance | 1. On Day 2 at 09:00 the "just a quick one" email arrives. Three experiments complete it and pay 200. 2. Letting a PI request expire gives the friendly miss email and 50. 3. The Equipment Call shows a countdown. Applying before the deadline pays 2,000 and Prof. Quince walks in with cake. 4. Letting the deadline pass shows the portal crash email and a new deadline. 5. A contaminated culture shows green fuzz and can be binned. 6. The autoclave can break and be fixed by coaxing or by the engineer. 7. A lost order appears in the corridor with a question mark and can be collected. 8. The inspection is announced a day ahead. Tock walks through every room. Each passed check pays 50. 9. No failure event fires in the first 6 minutes of a new game. |
| Skip | The facility, visitors buying media, the checklist party, sound. |

**Milestone 7: Media Facility, goals and onboarding**

| | |
|---|---|
| Scope | The Media Facility: room unlock, media prep unit, media technician, target slider, auto-reorder. Visitors who buy media. The Lab Warming list in the management panel and as a top-bar progress ring. The Lab Warming Party and group photo card. The full to-do note that guides the first 12 minutes (through the first hire). The feedback prompts at the party and at 30 minutes. Goal times recorded for the feedback report. The scripted bots and the pacing test from 12.3. |
| Acceptance | 1. The Media Facility is locked below Reputation 30 with a clear reason. 2. Once built with a prep unit, a media technician arrives and media stock rises to the target without the player. 3. Auto-reorder buys powder when it runs low. 4. Visitors walk in, take media, pay and leave. 5. Each checklist item ticks at the right moment. 6. With all five ticked, the party plays once and the game continues. 7. A first-time player following only the to-do note reaches their first hire. 8. The pacing test passes in CI. 9. The feedback report lists the play time at which each goal was reached. |
| Skip | Art, sound, Office room polish, tier 3 polish. |

**Milestone 8: Art pass, sound, balance and playtest build**

| | |
|---|---|
| Scope | Stage B pixel-map sprites for the whole v1 sprite list. Walk and work animation frames. Small effects (sparkle, steam, fuzz, confetti). Sound effects generated with the Web Audio API: step, pop, ding, ping, cha-ching. A mute button. No music. UI styling pass in the palette. Balance fixes from running the bots and one human run. A "How to play" card on the title screen. Optional itch.io upload. |
| Acceptance | 1. No placeholder rectangle or text label remains in the world. 2. All sprites use only the 16 palette colours. 3. Characters face the way they walk and animate. 4. Sounds play for job done, email, money and placement. Mute works and is remembered. 5. A human first-time run reaches all five goals in 25 to 35 minutes at 1x. 6. The game holds 60 frames per second on a mid-range laptop with 8 staff. 7. The live link works in current Chrome, Firefox and Safari. 8. `CREDITS.md` exists and is accurate. |
| Skip | New content, new mechanics, mobile and touch support. |

### 12.3 Testing approach

- **Unit tests (Vitest), in `tests/sim/`.** One file per system. They build a small state, run `step` a number of times with commands, and check the result. No browser is needed.
- **Must-have tests:** determinism (same seed and commands give the same serialised state after 5,000 ticks). Pathfinding (shortest path, blocked path, cache invalidation). Each job's inputs and outputs. Storage capacity limits. Contamination rules (never in the first 6, never twice in a row). Placement validation. Staff priority choice. Salaries and negative funds. Deadline extension. Save round trip. Each migration. Import of a corrupted string fails safely.
- **Content checks.** A test walks every content table and checks that every id referenced exists, every cost is a non-negative integer, and every event has text.
- **Pacing test, in `tests/balance/`.** Two scripted bots play through the sim API with no rendering. The average bot follows the plan in 2.3 with realistic delays. It must tick all five goals between tick 10,800 and tick 16,800 (18 to 28 minutes). The slow bot acts at 60% efficiency and must finish before tick 24,000 (40 minutes). Neither bot may ever be stuck with no legal action. This test is the guard for the "about 30 minutes" promise. Run it after every balance change.
- **Manual smoke check per milestone.** The acceptance list is the script. Run it on the live link, not only on the dev server.
- **No end-to-end browser automation in v1.** The view is thin. The acceptance lists cover it.

---

## 13. Post-v1 roadmap

In rough order. None of this is in v1.

1. **Microscope Facility.** Bookable scopes. A booking calendar that is always full on the day you need it. Imaging experiments give "Pretty Pictures", which raise paper Reputation.
2. **Sequencing Core.** Submit samples and wait. Results return as a big Data payout. Queue gags. A bioinformatician staff type.
3. **Animal House.** Handled gently: a clean facility with care staff, husbandry routines and paperwork. Unlocks in vivo studies, which finally satisfy Reviewer 2. For a moment.
4. **A bigger building.** Free-form room drawing. More floors with a lift. A proper goods-in, a seminar room, a cold room, a minus-80 freezer farm with an alarm that only goes off at weekends.
5. **More people.** PhD students who learn over time, a lab manager who automates ordering, visiting students, staff stories and birthdays.
6. **Deeper science.** Project lines with different equipment needs, conferences and travel, collaborations with neighbouring labs.
7. **More events.** Audit season, the freezer defrost, the departmental retreat, the Christmas party.
8. **Quality of life.** Multiple save slots, touch controls, music, colour-blind checks, translations.
9. **Port.** Because the sim is pure TypeScript, it can run under a different renderer or inside a desktop or mobile wrapper without a rewrite.

---

## 14. Open questions for Dillon

Each has a default. The build proceeds on the default unless Dillon says otherwise.

| # | Question | Recommended default |
|---|---|---|
| 1 | Should rooms sit on fixed plots along a corridor, or should the player draw rooms freely? | Fixed plots for v1. Six plots, equipment placed freely inside. It is much faster to build and easier for a first-time player. Free drawing moves to post-v1. |
| 2 | Where should the shared link live? | GitHub Pages from a public repository, deployed by GitHub Actions. Add itch.io later only if a private link is wanted. |
| 3 | How should playtest notes reach you? | Copy-to-clipboard and download only. Your wife pastes the notes into whatever chat you already use. Give an email address if you want the Email notes button turned on. |
| 4 | Should v1 have sound? | Yes, a handful of soft generated sound effects with a mute button. No music in v1. |
| 5 | How local should the flavour be? | Light European research-institute flavour in English: "gene-technology inspection", coin icon instead of a named currency, "Prof. Dr." titles. No real institutions, funders or regulations are named. |
