# Forge of the Elements: Beta 1.3.2 hotfix

Changes since Beta 1.3.1. At release these fold into the in-game patch history (`FOTE_PATCHES` in `js/update.js`) when `FOTE_VERSION` moves to Beta 1.3.2.

## Graphics and presentation

- Monsters face the way they walk. They used to turn toward you whatever they were doing, so a Shambler or goblin wandering away from you walked backwards. They still turn to face you when they notice you or attack.
- Enchanted body armor no longer wraps your character in a coloured glow, which drowned the figure in dark places like the Underdark. The enchantment still shows on the armor's card.
- Spotting or finding a trap (in passing, by searching, or with the Keen Eyes ring) now rings its tile and lifts a "!" off it, so you can see what was found (and, when spotting or searching, what the chime was about). With reduced motion there is no flash; the trap just appears on the map.
- A dart trap you have found under a bush, brazier or other prop now shows: the steel tips of its darts glint at the prop's feet. Before, spotting one chimed and nothing appeared.

## Interface

- A creature that dies where you cannot see it is no longer named in the log, unless you or one of your allies killed it.
- Hovering a mote now says what it is for: fusing at the Elemental Forge (on the third or fourth floor of each biome), setting into gear, or carving a sigil. The first mote you pick up in a run says where the Forge is too.
- The Equipment sheet's Defense totals now show your Stealth, with a line on what raises it (standing still, tall grass, dark rooms) and what lowers it.
- Picking up a mote chimes at half volume, level with picking up essence.
- At the Forge, the Affinity, Cap and Essence lines are bright white and bold instead of dim grey, so they read at a glance. Your element's colour and the gold essence count stay as they were.
- Walking through tall grass rustles at a quarter of its old volume, closer to a footstep on stone.
- The victory sting when you press a boss core into the exit gate plays at 30% volume; the fanfare for winning the run is unchanged.
- Sounds now fade with distance: anything within 5 spaces plays at full volume, 6 to 8 spaces at 70%, 9 to 12 at 30%, and nothing farther away is heard, so a trap a wandering monster sets off across the floor no longer clangs in your ear. Your own swings, casts and footsteps, menus, stairs and level-ups always play in full.
- The chime for spotting a trap and the impact of magic-type bolts (magic missile and the like) now play at half volume; they were louder than everything around them.
- A trap a monster springs where you can see it now names the monster, spikes included ("Spikes drive up into the Goblin: 7 damage."). One sprung out of sight but within 12 spaces is heard instead, with a direction ("You hear a trap spring to the northeast."), without naming the monster even if the trap kills it, and one farther away is not reported at all. Before, a trap anywhere on the floor was reported the same whether you could see it or not.
- An alarm bell a monster sets off is no longer reported as if you had rung it: "The Goblin sets off an alarm bell!" when you can see it, "You hear an alarm bell ring to the west." when you can only hear it, and nothing beyond 12 spaces. It still wakes the same monsters as before. Your own alarm reads as it always has.
- The start-of-run tips (how to move and attack, the keys for your bag and faith, and that traps show once you spot them) now appear on your first run. The run the title screen starts behind itself used them up, so they never showed.

## Gameplay and balance

- An alarm bell now draws monsters to the bell rather than straight to you: everything within 16 tiles wakes and walks to it, and only comes for you if it notices you on the way or when it gets there. A monster already chasing you keeps chasing you.
- Shamblers now rot you when they hit, like Grave Bloats, and Rot (no health regeneration) lasts 30 turns instead of 20.
- Tall grass now hides you on the turn you step into it. Your step tramples it, and the trampling happened before monsters looked, so its stealth bonus never applied while you walked. Grass you have already trampled still does not hide you.
- Resting now stops when an alarm bell rings within 12 spaces of you, or when a monster that close starts hunting you. Before, it only stopped for a monster in sight, so you could rest on through a bell and wake to whatever it brought.

## Performance and fixes

- A slain Puffling or Pebbling now "collapses into an air mote" (or an earth mote) instead of "a air mote", the same way picking a mote up already read.
- The dart trap's sound no longer clicks when it starts and stops. The file sat on a large DC offset (its waveform started far below zero and drifted back up), which speakers turn into a thump or click. The offset is removed; the part you hear is unchanged.
