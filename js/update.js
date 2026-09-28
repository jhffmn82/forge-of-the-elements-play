/* Release history and title-screen freshness checks. Saves are never cleared. */
var FOTE_VERSION = 'Beta 1.3.2';
/* Keep newest first; describe only changes already present in this build. */
var FOTE_PATCHES = [
  {version:'Beta 1.3.2', notes:[
    "Monsters face the way they walk. They used to turn toward you whatever they were doing, so a Shambler or goblin wandering away from you walked backwards. They still turn to face you when they notice you or attack.",
    "Enchanted body armor no longer wraps your character in a coloured glow, which drowned the figure in dark places like the Underdark. The enchantment still shows on the armor's card.",
    "Spotting or finding a trap (in passing, by searching, or with the Keen Eyes ring) now rings its tile and lifts a \"!\" off it, so you can see what was found (and, when spotting or searching, what the chime was about). With reduced motion there is no flash; the trap just appears on the map.",
    "A dart trap you have found under a bush, brazier or other prop now shows: the steel tips of its darts glint at the prop's feet. Before, spotting one chimed and nothing appeared.",
    "A creature that dies where you cannot see it is no longer named in the log, unless you or one of your allies killed it.",
    "Hovering a mote now says what it is for: fusing at the Elemental Forge (on the third or fourth floor of each biome), setting into gear, or carving a sigil. The first mote you pick up in a run says where the Forge is too.",
    "The Equipment sheet's Defense totals now show your Stealth, with a line on what raises it (standing still, tall grass, dark rooms) and what lowers it.",
    "Picking up a mote chimes at half volume, level with picking up essence.",
    "At the Forge, the Affinity, Cap and Essence lines are bright white and bold instead of dim grey, so they read at a glance. Your element's colour and the gold essence count stay as they were.",
    "Walking through tall grass rustles at a quarter of its old volume, closer to a footstep on stone.",
    "The victory sting when you press a boss core into the exit gate plays at 30% volume; the fanfare for winning the run is unchanged.",
    "Sounds now fade with distance: anything within 5 spaces plays at full volume, 6 to 8 spaces at 70%, 9 to 12 at 30%, and nothing farther away is heard, so a trap a wandering monster sets off across the floor no longer clangs in your ear. Your own swings, casts and footsteps, menus, stairs and level-ups always play in full.",
    "The chime for spotting a trap and the impact of magic-type bolts (magic missile and the like) now play at half volume; they were louder than everything around them.",
    "A trap a monster springs where you can see it now names the monster, spikes included (\"Spikes drive up into the Goblin: 7 damage.\"). One sprung out of sight but within 12 spaces is heard instead, with a direction (\"You hear a trap spring to the northeast.\"), without naming the monster even if the trap kills it, and one farther away is not reported at all. Before, a trap anywhere on the floor was reported the same whether you could see it or not.",
    "An alarm bell a monster sets off is no longer reported as if you had rung it: \"The Goblin sets off an alarm bell!\" when you can see it, \"You hear an alarm bell ring to the west.\" when you can only hear it, and nothing beyond 12 spaces. It still wakes the same monsters as before. Your own alarm reads as it always has.",
    "The start-of-run tips (how to move and attack, the keys for your bag and faith, and that traps show once you spot them) now appear on your first run. The run the title screen starts behind itself used them up, so they never showed.",
    "An alarm bell now draws monsters to the bell rather than straight to you: everything within 16 tiles wakes and walks to it, and only comes for you if it notices you on the way or when it gets there. A monster already chasing you keeps chasing you.",
    "Shamblers now rot you when they hit, like Grave Bloats, and Rot (no health regeneration) lasts 30 turns instead of 20.",
    "Tall grass now hides you on the turn you step into it. Your step tramples it, and the trampling happened before monsters looked, so its stealth bonus never applied while you walked. Grass you have already trampled still does not hide you.",
    "Resting now stops when an alarm bell rings within 12 spaces of you, or when a monster that close starts hunting you. Before, it only stopped for a monster in sight, so you could rest on through a bell and wake to whatever it brought.",
    "A slain Puffling or Pebbling now \"collapses into an air mote\" (or an earth mote) instead of \"a air mote\", the same way picking a mote up already read.",
    "The dart trap's sound no longer clicks when it starts and stops. The file sat on a large DC offset (its waveform started far below zero and drifted back up), which speakers turn into a thump or click. The offset is removed; the part you hear is unchanged."
  ]},
  {version:'Beta 1.3.1', notes:[
    "The Crypt Shambler is now a clearer fantasy zombie, with new idle, shambling walk, clawing attack and collapse animations. Its revival and fallen body work as before.",
    "The Dungeon Rat has new art: a scruffy brown rat with its own idle, snarling lunge-bite, flinch and collapse animations, the same length on the map as before and without the pale outline. The Cave Rat shares it.",
    "Floor skulls and bone piles are now half their original size, so they sit on the floor as scenery instead of dominating the tile. Their placement and footprint are unchanged.",
    "Weapons, shields, tomes, orbs and holy symbols are sharp on the map and on the Equipment doll, including close zoom, high-resolution screens and phones. Held gear no longer smears when shown large or shimmers when shown small.",
    "The Equipment doll is drawn in one clean pass and keeps its full size. In a wide window a two-handed axe now shows its whole blade, and on phones the Gear tab gives the character its own space, so the main-hand weapon and the full shield are visible.",
    "Held gear stays in the hand: a sword no longer flips across the body for a frame mid-walk, a shield no longer drops to the hip mid-spell, and a shield or focus no longer hides behind the character while standing or walking.",
    "Icons in the worn slots, the bag and the hotbar are painted at the size they are shown, so they stay crisp on every screen. Rings and amulets now show at their true size beside weapons instead of being blown up and blurred.",
    "Shooting a bow no longer draws your sword, axe or shield over the bow in your hands. Melee gear is put away for the shot and comes back when it ends.",
    "The staff in your hand now wears the gem-topped head from its icon on the same wooden shaft, with a clean dark outline, so it reads as a staff on the map and the Equipment doll instead of a plain stick.",
    "The Ceremonial Knife in a cleric's hand is now a clear bone knife that matches the other weapons, instead of a few grey specks floating above the fist.",
    "Starting tomes, holy symbols, orbs, staves and wands keep their own colours on the character instead of turning grey, so they match their icons.",
    "Body armor is no longer painted onto your character as a flat patch of colour over the chest. Every character now shows their own outfit as drawn; an enchanted armor still gives a soft glow of its element around the figure.",
    "The glow around an enchanted weapon is the same size on every screen. On phones it was about a third as large, and on high-resolution displays about half.",
    "The character creation preview now shows your starting kit: the weapon, shield or focus in hand and the armor you will wear, drawn the same crisp way as the Equipment doll.",
    "Followers of Chad the Unclad hold their Holy Symbol in the hand on the Equipment doll and in the creation preview, instead of it floating at the hip.",
    "Traps, props, chests and set pieces now finish loading before the game appears. Continuing a save, entering a new biome or spotting your first trap no longer shows their old artwork for a moment before the new art.",
    "Painted spark, teleport and fire, gas and frost vent traps no longer have the old zigzag, rune rings, glow and wisps drawn over them. A vent hidden under a brazier or other prop still gives off its glow.",
    "If the trap and prop artwork fails to download, the loading screen's Retry button now fetches it again instead of leaving the old art in place.",
    "Goblins, their archers, shamans, brutes and Warchief, and the Shambler now show their new animated art from the first sighting, including remains in a continued save, instead of briefly showing the old sprites.",
    "The Unmaker's Discord Prism pylons are animated from the moment they appear, instead of first showing as still crystals.",
    "Every biome's floor and wall artwork now loads on the loading screen with the rest of the game's art, the Realm of Chaos included, so the Crypt, the Underdark, the elemental planes and the Realm of Chaos no longer appear in their old floor and wall art first, and nothing downloads while you play. The loading screen takes longer as a result.",
    "If a floor's artwork is ever still missing when you arrive, the previous view stays on screen (the title screen when continuing) and your moves wait until it is ready, instead of showing the old art.",
    "The Caverns rope bridges and the forge in the Unmaker's Crucible now show their new art from the start.",
    "Caverns, plane and Underdark rock no longer stays blocky in patches, or flicks back to blocky, on phones, at wide zoom or with the map revealed. Once the detailed stone has appeared, it stays.",
    "Entering the Fire, Water or Air plane no longer shows flat colour squares for a moment.",
    "Torch stands, soul braziers and candelabras now show only their own painted flames, with a soft flicker, instead of a second blocky flame drawn on top. Lit braziers keep their animated flame.",
    "Props and traps outside the view are no longer drawn every frame, so explored floors are lighter to render, especially on phones.",
    "Crates, barrels, pots, statues, carts, cages and candle tables no longer have an old dark outline and speckled moss baked onto their new art, and the Crypt's urns keep their painted colours and edges.",
    "Plants are no longer washed grey, so their painted greens come through.",
    "Dungeon grass now sits on a single soft moss bed drawn at full detail, instead of two stacked shade layers with a blocky speckle.",
    "In the Crypt, floor grime and green ooze now lie under traps, mushrooms, bones and props instead of being painted over them, and grime on remembered floor fades like the floor it is on.",
    "The square dark band along the foot of every wall, and the dark strips painted at the ends of wall faces, are gone; the painted walls and the lighting shade their own bases. Block Art keeps its band.",
    "Chasm edges in the Dungeon now take the colour of the new warm floor stone instead of the old grey, and the Crypt's match its floor more closely.",
    "With Lighting off, remembered floor no longer shows a faint lighter grid, and floor tiles no longer leave hairline seams at some zoom levels and screen scales: each tile now covers exactly its own screen pixels.",
    "An opened door keeps its look: iron doors open onto their iron leaf, spiked and thorn-grown doors onto their wooden leaf, and melted ice, crystal and Crypt doors leave a bare stone arch, instead of every door turning into the same wooden one.",
    "Goblins, the Shambler and the Realm of Chaos foes no longer have a pale outline drawn around them; their new art has its own dark edge. Older creatures keep the outline.",
    "A dying creature is lit like everything around it, so its body no longer glows brighter while it falls and then darkens when it lands.",
    "Long fights no longer keep adding to memory use through creature outlines and hit flashes.",
    "The Dungeon's floor stones no longer line up with the rows of map tiles, so the floor no longer shows a dark line along every row. They are the same painted stones, a little smaller.",
    "Painted traps now sit at the size and place their artwork was drawn for, instead of being squeezed into the old plate outline. The teleport rune is no longer squashed, fire and gas vents fill their tile, and the alarm tripwire lies across the floor.",
    "A Shambler that collapses no longer shows two bodies for a moment, and its fallen body now lies facing the way it fell.",
    "Grukk the Warchief's turn no longer lingers for a moment after his attack has finished.",
    "With Motion turned off, goblins and the Shambler now behave like the other Dungeon and Crypt creatures: still at rest, while their attacks and collapse still show.",
    "The game downloads about 0.8 MB less old creature and portrait artwork before it starts; goblins and the Shambler now come only from their new animated art.",
    "Chests, Underdark set pieces, plants and mushroom and urn clusters now come only from their new artwork, so none of them can briefly show an older version while loading. The game also downloads about 0.4 MB less old artwork before it starts.",
    "A floor is now built the same way whether or not its artwork has finished loading. Crypt candles, grave posts, urns, tombs and wall fungus, crystal vault markers and plane scatter no longer go missing or change places on a slow connection, so a seed always makes the same level.",
    "New art for every Fae and Gloomling character: all four Fae courts, male and female, now wear practical clothes in their court's colours, and the Gloomlings have their new look. Each has a fresh idle, walk, spellcast, bow shot, melee strike, flinch and fall, and appears the same way on the map, the Equipment doll, the character creation preview and your Shadow Clone.",
    "Gloomling followers of Chad the Unclad have new underwear art and animations to match. Fae followers keep their current underwear look. Every follower's underwear art now loads with the rest of the game, so it shows from the first moment instead of a stand-in figure.",
    "The new Fae and Gloomling bow shot is drawn with your own bow in hand, held upright with the string toward you, and your sword, shield or focus are put away for the shot as before.",
    "Charge has a new icon: a shield with a gold impact flash, instead of a small running figure.",
    "Fine and Masterwork weapons and shields no longer glow blue or gold on your character; they are drawn as painted. Worn gear still looks dull.",
    "Essence crystals are now violet, so they no longer look like the blue mana globes on the floor. In Block Art essence is a violet dot too.",
    "Stacked items on the hotbar show how many you carry in the corner of the slot, on desktop and touch. The number updates as soon as you use, pick up or drop one, and disappears when only one is left.",
    "Your worn amulet can be dragged from the Equipment sheet onto any hotbar slot. The amulet's slot also accepts items and other slots dropped onto it again.",
    "Drag any hotbar slot (ability, prayer, item or amulet) off the bar and let go to remove it. Nothing is unequipped or dropped, and a removed ability or prayer stays off the bar until you drag it back from the Character or Faith sheet. Swapping slots, right-click and the touch long-press Remove work as before.",
    "Drag an item out of the inventory window and let go over the map (or anywhere that is not another slot) to drop it on the ground. It is the same as the Drop command: same turn cost, same rules. A short drag, or letting go back inside the window, never drops anything.",
    "Descriptions across the game were reviewed and rewritten for clarity and accuracy, with no em dashes. Spells, prayers, gear, sigils, statuses and hints now say plainly what they really do.",
    "The Unmaker's card (hover over the boss, or press and hold it on a touchscreen) now shows a short tip for fighting its current form: the Crowned Tyrant, the Unbound or the Heart of Discord. The tips were written for the fight but never appeared on the card.",
    "The browser tab now shows the game's icon.",
    "On a phone turned sideways, the title menu sits below the \"Forge of the Elements\" logo instead of covering it, with its buttons sized to fit the screen.",
    "The hotbar has a new look: each slot is a dark well with the ability's colour as a soft glow inside it, and every icon sits on a shadow so it stands out.",
    "A hotbar skill or prayer on cooldown now greys out, shows a dark clock sweep for the time still to run and a large turn count in the middle, and flashes gold once when it is ready again.",
    "The level bar shows just your level (LV 15) instead of also printing your experience numbers, so it stays on one line on small screens. Hover it to see the exact experience.",
    "Prayers and god invocations now have cooldowns, each its own: single-target buffs wait about half again their base duration, single-target divine attacks wait 2 turns, area prayers 8, and summons, heals and other utility prayers 20. Invocations that are not buffs, including Saint Glimmer's Heal, have no cooldown. A Holy Symbol still lengthens buffs but never the wait. The hotbar, hover card and Faith tab show \"ready in N\" while you wait.",
    "Chad the Unclad: each landed punch now grants 0.3 piety instead of 1, so rank comes from sustained fighting rather than a handful of hits. Unarmed kills still pay their full piety reward.",
    "Dwarves' armor now counts as one upgrade higher, like their weapons always did: +1 armor on any armor, plus +2 evasion in leather and +3% spell damage in a robe. The old flat +1 armor that applied even with no armor on is gone, and the race description now says what the bonus really is.",
    "Only attacks pause the game now. Monsters that move on the same turn all step at once instead of one after another, so a room full of wandering monsters takes about the time of a single step instead of one step per monster. Swings, spells, arrows and falling creatures still play one at a time, in turn order, and a monster that steps up and attacks in the same turn finishes its step before it swings.",
    "The Tide Crab can always be beaten now. Its shell still takes the first blow of each turn, but after three blows it cracks and every hit lands. Before, a character landing one attack a turn could never hurt it. Its card now explains the shell.",
    "The Deep Maw no longer leaves you alone between eruptions: each time it bursts out of the ground it calls up a Worm Tender, a myconid of its brood in the Maw's own earth-brown and bruised pink, beside one of its burrow mounds. Only one is alive at a time. It fights exactly like a Myconid, with the same poisoning, slowing spores and Shroomlings, gives experience and counts for kill effects like any other foe but drops no loot, and when the Maw dies it sinks back into the ground with its Shroomlings and its spore clouds settle. The Maw's card and its own say so.",
    "Enemies that other creatures call up in a fight (the Deep Maw's Worm Tender, Shroomlings, raised skeletons and Shamblers, the Matron's spiderlings and driders, Chaos offspring, split slimes and the like) now give experience and count as kills for your god: piety, favor and on-kill boons such as Mother Murk's healing all work on them. They still drop no loot, so a summoner cannot be farmed for items.",
    "The game is about a third smaller to download (180 MB down to 122 MB): artwork now ships in a smaller lossless image format and the music uses a lighter encoding, so first loads, offline installs and updates finish sooner.",
    "Mother Murk's Grave Strength now applies once per attack by your servant or summons. A summon's elemental follow-up hit no longer adds the extra shadow damage and your weapon's enchantment a second time.",
    "Playing in a browser no longer downloads the entire game in the background; only the installed app and the Android app keep a full offline copy. A slow connection now says it is still loading instead of looking frozen, and offers a Reload button only if nothing at all arrives for a full minute.",
    "Monsters you cannot see no longer hold up the game. A wanderer setting off a trap or taking poison damage out of sight, or anything moving or fighting off the edge of the screen, no longer delays your next move or the monsters you can see.",
    "Wandering monsters now work out their routes with about half the work, so a turn on a floor with many wanderers takes about a third less time, especially noticeable on phones. They choose exactly the same routes as before.",
    "A busy turn is drawn once instead of once for every visible monster that moves, which also saves time on phones.",
    "On slower phones, a floor full of wandering monsters no longer makes your hero or the monsters you can see skip part of a step. Every step now slides the whole way, starting as soon as the monsters have all chosen their moves.",
    "Returning from an elemental plane to the Underdark, or going up and back down the stairs there, no longer breaks the floor's drawing, stops the animations, leaves the plane's music playing or skips the autosave.",
    "Entering the Caverns, the Underdark's caves or an elemental plane, and stepping through a portal to another Chaos island, is now close to instant: the rock and ground appear fully detailed in the very first frame instead of sharpening in over several seconds (up to 10 to 17 seconds on slower phones). Nothing about how they look has changed.",
    "Walking through caves and planes no longer shows blocky or flat squares at the edge of the view. The ground ahead of you is prepared in the background, on your device's spare processor cores.",
    "Walking into the Dungeon's grassy rooms no longer hitches while the moss bed under the grass is drawn: each patch is built about twice as fast, and the patches just outside the view are prepared ahead of time while the game is idle. The moss looks exactly the same.",
    "Every frame does far less work, so a slower computer or a phone keeps up while you walk: the lighting setting and the map are read once a frame instead of once per tile, the light map works tile by tile, and the floor, walls and still ground cover (moss, grime, chasm edges, water beds) are drawn once and reused while they stay the same, instead of being redrawn 30 to 60 times a second. Water glints, ooze, swaying plants, flames and every creature stay animated, and a still picture looks the same as before. On a computer four times slower than a desktop, a frame takes a quarter to a half less time to draw depending on the biome, and hitches longer than a tenth of a second are cut by 30 to 80 percent."
  ]},
  {version:'Beta 1.3', notes:[
    "Refreshed floors, walls, doors, bridges, props, traps and vegetation with detailed artwork, including cave walls throughout the elemental planes. Smaller scenery and softer enemy outlines make the map easier to read.",
    "The Goblin family has matching animated artwork, including Grukk. The final Forge and the Unmaker's beam pylons have dedicated animations.",
    "Block Art is available in Options and remembers your choice, with consistent blocks and symbols for map scenery, creatures, hazards and remains.",
    "The title screen now uses the instrumental menu theme, continuing smoothly into character creation. Level-up and victory sounds are quieter.",
    "Grukk's battle now has a subdued ambient theme with low sustained tones and quiet dungeon sounds, leaving more room for combat audio.",
    "Cursed rings now apply their intended penalties, including life drain from Mending and worse trap spotting from Keen Eyes. Corrected older cursed rings whose upgrade values could accidentally grant benefits.",
    "Amulet curses remain hidden when equipped. Using a cursed amulet reveals it, spends a charge and unleashes a random trap instead of its normal power. Identifying an amulet can still expose its curse safely.",
    "Ordinary Goblins have less health on the first two floors, shortening the opening fights. Existing saves receive the adjustment without healing wounded enemies. Rats keep their original health.",
    "Single-target spells now trigger general on-hit effects, including weapon enchantments, elemental bonuses and combinations, Molten Ring, and Sylla's Web and concealed opening strike. Magic Missile and divine bolts follow the same rules; secondary damage cannot trigger these effects again.",
    "Damage labels now consistently use physical, poison, light, shadow, frost, fire, magic and lightning. Corrected Air attacks being labeled as air damage, mixed-element bonus labels, and repeated spells using the wrong damage type or applying resistance twice.",
    "Dungeon Rats and Goblins hit less hard on the first floor, making the opening fights more forgiving. Their damage on later floors is unchanged.",
    "The final Forge of the Elements has its own animated artwork, with six elemental sources feeding the anvil. Existing saved final chambers receive the new art.",
    "Added a richer victory and defeat summary with a final score and score breakdown. Previous Runs keeps a local high-score list, with victories first; sandbox runs are excluded.",
    "Scoring now rewards XP and essence earned relative to turns taken, together with depth, level and faith progress. Winning multiplies the result, and spending essence does not reduce your earned total. Earlier scores stay in their own groups; older saves clearly label estimated earnings.",
    "Previous Runs and Settings are now available from the title screen, and character creation has a Back button. Audio, display and key bindings can be adjusted before starting a character; motion settings now persist.",
    "The Unmaker calls reinforcements throughout the battle. In his second form, three crystal pylons fire independently telegraphed beams while he threatens other areas, making positioning matter throughout the fight.",
    "Boss cores now land on reachable ground, separately from other treasure, even when a boss is defeated outside its lair. Loading an affected save repairs a missing or inaccessible core.",
    "A loot-filled Caverns boss chamber can still open its exit, instead of ending the adventure early.",
    "Fixed the Light realm getting stuck after lethal reflected damage. Older saves interrupted by this bug recover at one HP, while completed deaths remain final.",
    "Glimmer and Light mastery now create the same Holy Ground, with matching visuals, healing, protection and damage. Fixed field healing and overlapping effects, and made Glimmer's healing boon apply consistently.",
    "Dawn now strikes visible enemies with Light damage as well as blinding and revealing them. Attacking a blinded enemy now counts as a surprise attack.",
    "Glacial Tomb now blasts the area around its entombed target with Frost damage. Upheaval raises its wall with a damaging eruption that roots nearby enemies and summons. Their targeting previews show the affected areas, and Upheaval spends nothing when no walls can rise.",
    "Rooted, stunned and incapacitated creatures lose their Evasion until they recover. Combat checks and character displays use the same effective value.",
    "Light weapon enchantments now improve critical chance, replacing their previous accuracy and extra damage bonuses.",
    "Fortitude recovers more often and is no longer consumed by a blow that shields absorb completely. Selected nimble enemies are harder to hit, giving Accuracy more value.",
    "Rock Slimes spit rooting stone, Shades chill with their touch, and Lens Bearers fire blinding Light beams. Elemental attack damage now consistently respects defenses, and every Light-realm creature is vulnerable to Shadow.",
    "Corrected missing Vellum bonuses on equipment passives and made their item cards show the benefits actually received. Clarified Reginald's bonuses and standardized ability and item descriptions to use %.",
    "Tourists now start with a Hawaiian Shirt and its own artwork. Fixed malformed puzzle sigils and repaired affected items in existing saves.",
    "Corrected the Deep Maw appearing beneath its pits and the dark rectangle over its exit. Repaired raised weapon positions in the female Gloomling's walk, and made magical summons dissipate without leaving the wrong creature's corpse."
  ]},
  {version:'Beta 1.2', notes:[
    "Expanded the landscape map by removing its outer gutters and tightening the side panels. Menu buttons use two rows, the combat log has more room, and phone movement controls use the space beneath your stats.",
    "Made landscape ability and prayer descriptions use the full row, with mana, cooldowns and charges below the name so they no longer squeeze the text.",
    "Mobile defaults to Landscape, while Options remembers your choice of Portrait or Landscape. Stats and movement sit on the left, menu buttons and a larger combat log on the right, and menus over the map with the hotbar below.",
    "Mobile equipment now keeps two columns of worn slots beside the full bag, with matching tiles that fit phone and tablet screens.",
    "Fixed Character, Equipment and Faith screens disappearing on phones in landscape. Menus now reserve only the space used by the hotbar, including after rotating the device.",
    "Kept confirmation dialogs above the screen that opened them, made title buttons reachable on short screens, and removed the small-phone rotation blockade. Embedded games now leave fullscreen handling to their host.",
    "Replaced the Caverns' chirping ambience with a quieter underground music loop, and gave Chaos demons creature voices and sounds for their special attacks.",
    "Myconids now rest in place between actions. Crates, pots, urns and mushroom groups use fixed artwork so their pieces no longer disappear or overlap unpredictably.",
    "Defeated creatures leave their bodies on the floor for a while. These remains survive saving and returning to a floor without obstructing movement.",
    "Softened the Water realm's forced movement. Sirens no longer take away your turn, and groups of pulling enemies must give you time to recover.",
    "Strengthened the Deep Maw's attacks and health to make the Caverns finale more demanding.",
    "Boss cores now expand your elemental infusion limit as soon as you pick them up. Opening the exit still uses the core, and existing characters retain their progress.",
    "Corrected holy-symbol enchantment tooltips and replaced the obscured Root status icon with clear artwork.",
    "Character and equipment screens now show movement and attack speed as percentages. Chad's Living Mountain also displays its current stack count beside its remaining duration.",
    "Focused Chad's Living Mountain on offensive momentum, removing its extra defensive bonuses. Pummel activates instantly without advancing enemies.",
    "Armor still softens physical blows, but no longer erases small hits so easily. Accuracy and Evasion now have a stronger effect on whether attacks land.",
    "Deadeye and Keen Aim now also increase critical-hit damage, giving Agility builds stronger offensive rewards as they develop. The bonus applies to attacks and spells alike.",
    "Poison damage now respects the victim's resistance. Follow-up effects no longer report misleading zero damage after an enemy has already been killed.",
    "Improved enemy routes around bushes and crowded passages, including approaches from diagonal tiles.",
    "Added a craftable Sigil of Haste and strengthened Molten Ring with fire damage on attacks while its effect lasts.",
    "Every enemy now has a short lore description on its hover card, replacing detailed implementation notes with a sense of who inhabits these realms.",
    "Fixed the Matron's exit rejecting the Ruin Core. Existing saves can now unlock the gate normally and continue into the treasure room before Chaos.",
    "Opened the Realm of Chaos beyond the Matron, extending the adventure through the final encounter and the Forge of the Elements.",
    "Added a quiet treasure room before entering Chaos, with essence, Masterwork equipment, elemental motes and rations to prepare for the last biome.",
    "Chaos floors mix five floating islands drawn from four distinct realms. Portals connect islands, magical currents carry you between floors, and a dedicated elemental gateway marks the crossing to the material plane.",
    "Added animated Chaos demons with distinct attacks, status effects and immunities. Enemy groups react together to make late-game encounters more demanding.",
    "Chaos contains no god shrines; your existing faith and powers remain with you.",
    "Added the Unmaker's three-form final encounter, dedicated animation and battle music, a preparation forge and gates tied to the battle. His larger body occupies the full space shown and can be targeted across it.",
    "The Heart of Discord calls Chaos demons into the fight. Boss attack warnings use colored areas without numbers printed on the floor.",
    "Defeating the Unmaker opens the way to the Forge. Interact with it when you are ready to retire and finish the run, or keep exploring.",
    "Fixed Fear so affected players retreat, and preserved explored floors, treasure and encounter state when traveling or continuing a saved run.",
    "Strengthened Ring of Mending's regeneration and corrected its healing conversion so its displayed benefit matches actual healing each global round.",
    "Umbral Passage now leaves a shadow copy of your character to cast Shadow Bolt. It inherits your combat stats, follows you between floors, and remains until killed or replaced by another Passage."
  ]},
  {version:'Beta 1.1', notes:[
    "Improved terrain loading by removing an obsolete image request and waiting for artwork to finish loading before drawing it.",
    "Added a craftable Sigil of Transmutation for turning equipment into a different random item of the same category while preserving its quality, upgrades and existing enchantment. Canceling the selection keeps the sigil or Echo charge.",
    "Chad’s followers now use underwear versions of their existing character sprites, including movement and combat animations. Ordinary character appearances are preserved.",
    "The god of the bare fist is now Chad the Unclad. Existing characters retain their devotion and progression.",
    "Chad now refuses new dwarf worshippers. Existing dwarf followers remain loadable with their faith and equipment intact.",
    "Chad’s Living Mountain now builds strength with repeated punches, improving defense, accuracy, evasion, critical chance and damage. Divine Power helps that momentum last longer. This replaces Hardened and the old fist and body enchantments with a stronger reward for sustained melee combat.",
    "Chad’s Iron Body, Iron Hide and Pummel now activate instantly without giving enemies a turn. Their mana and Favor costs remain unchanged, and descriptions explain the timing.",
    "Extended Iron Body and strengthened Chad’s unarmored fighting style with rank-based movement and evasion bonuses, barehanded parrying, and faster punches at higher ranks.",
    "Restored direct touch dragging from inventory to the hotbar or equipment slots. Tapping still inspects an item, and releasing a drag does not use it.",
    "Made tablet inventory slots compact and arranged worn gear beside the bag so equipment stays accessible on iPad-sized screens.",
    "Fixed extra movement and actions after releasing controls during enemy animations. Busy-time key presses, taps and clicks are discarded instead of replayed later.",
    "Click-to-walk now stops immediately after taking damage during an enemy turn.",
    "Replaced Morty’s boss theme with a more driving orchestral loop and subtle crypt ambience to give the fight a stronger sense of menace.",
    "Pet movement no longer pauses your next action or the enemy sequence. Companions follow smoothly while their attacks remain animated.",
    "Enemies now finish each visible move or attack before the next creature acts, making crowded fights easier to follow. Turn order and creature speeds are unchanged.",
    "Removed duplicate terrain redraws that caused Caverns stutter. Travel, resting and saves now wait for a complete enemy turn.",
    "Rebuilt the core engine to make combat, equipment, summons and turn timing more consistent while preserving the existing interface and artwork.",
    "Improved Caverns terrain rendering to reduce stutter when exploring new areas.",
    "Unified status-effect rules so frost counts as a slow for Unstoppable and webs count as roots for abilities that benefit from rooted enemies.",
    "Strengthened save validation and recovery while retaining support for existing characters and explored floors.",
    "Fixed repeated hits against multipart enemies from a single area attack, surfaced Maw rendering, and canceled Echo casts creating extra sigils.",
    "Softened hotbar background colors so ability artwork stands out more clearly.",
    "Strengthened Shadow Swarm and made its health, damage and lifetime scale with Spell Power. Its shades now share the darker, translucent summon artwork and benefit from Murk’s Grave Strength.",
    "Barricade inspect cards now describe flammable wood instead of a nearby mechanism.",
    "Fixed touch inventory cards closing before Drop or Use could activate.",
    "Corrected Ring of Mending’s exaggerated healing tooltip to show its actual regeneration rate.",
    "Added Nature’s Bounty, a craftable sigil that creates a Honeycake, Mushroom Skewer, and Moonberry Tart nearby.",
    "Restored food satiety so meals fill the hunger bar as much as they originally did.",
    "Prayers now have explicit ability icons, including new artwork for Bone Spear and Vellum’s divine attacks.",
    "Shades raised by shadow weapon enchantments now use the animated shade sprite with darker, translucent coloring.",
    "Levers now show an interaction cursor and an inspect card explaining their purpose and whether they have already been pulled.",
    "Added readable patch history and update checks under the version-number button. Removed Exit Game and Install App from the title menu; browser installation remains available through browser controls. Updates preserve saves.",
    "Reworked divine abilities around Divine Power. Invocations spend mana; prayers spend divine favor. God restrictions prevent forbidden actions, and Clerics keep their chosen god.",
    "Chad now permits only holy symbols, rings and amulets. Reworked divine buffs, summons and favor rewards so their strength follows the chosen god and equipment.",
    "Vellum now offers Communion, repeatable divine attacks, stronger equipment passives and chances for knockback and free casting. Two-handed weapons and bows are forbidden.",
    "Wobbles now gains amusement during combat, slowly loses it during quiet exploration, and spends it on powers. High amusement brings rewards; an empty bar invites mischief.",
    "Rebalanced armor, shield, orb and tome enchantments to offer more defensive and offensive choices. All attacks and spells share critical-hit chance and critical damage.",
    "Forge enchant descriptions show scaling formulas; equipped items show their current bonuses. Divine Power now appears below Spell Power on character sheets.",
    "Raised advanced spell costs, strengthened enemies in selected biomes, and increased hunger drain to improve resource planning and late-game difficulty.",
    "Added area previews and lingering impact highlights for targeted area spells. Shortened Vanishing and made offensive spellcasting break concealment.",
    "Reworked puzzle interactions, added guardian shutoff switches, made barricades block entry, and gave levitation and elemental solutions clearer practical roles. Crystal rewards are inspected by hovering.",
    "Strengthened Living Flame, extended its duration, added splash attacks and replaced its art with a smaller animated fire elemental. Burning effects now use translucent animated flames.",
    "Enemies now react to summon attacks. Sylla webs apply Bleed and count as Root for Earth mastery, while her poison abilities retain their own effects.",
    "Added ambient dungeon loops and more dramatic boss music, including a replacement Crypt theme. Title and character-selection music remain unchanged.",
    "Improved hotbar readability, fixed amulet charge displays and floating firepit shadows, corrected descriptions, and consolidated superseded god and enchantment implementations."
]},
  {version:'Beta 1.0', notes:['Initial beta release.']}
];
var foteVersionState = {message:'Checking for updates…', latest:null, pending:null};
function foteBuild(){ return (document.querySelector('meta[name="fote-build"]')||{}).content||'dev'; }
function paintVersionStatus(){
  ['versionStatus','versionPanelStatus'].forEach(function(id){ var el=document.getElementById(id); if(el)el.textContent=(id==='versionPanelStatus'?FOTE_VERSION+' · ':'')+foteVersionState.message; });
  var b=document.getElementById('versionInstall'); if(b)b.hidden=!foteVersionState.latest;
}
function checkGameVersion(){
  if(foteVersionState.pending)return foteVersionState.pending;
  if(foteBuild()==='dev'){ foteVersionState.message='Development build'; paintVersionStatus(); return Promise.resolve(); }
  foteVersionState.message='Checking for updates…'; paintVersionStatus();
  foteVersionState.pending=(async function(){
    var controller=typeof AbortController==='function'?new AbortController():null;
    var timer=controller?setTimeout(function(){controller.abort();},8000):null;
    try{
      var r=await fetch('build.json?t='+Date.now(),{cache:'no-store',signal:controller?controller.signal:undefined});
      if(!r.ok)throw new Error('Unavailable');
      var b=await r.json(); if(!b||typeof b.built!=='string'||!b.built)throw new Error('Invalid build');
      foteVersionState.latest=b.built!==foteBuild()?b:null;
      foteVersionState.message=foteVersionState.latest?'Update available: open Version to install':'Up to date';
    }catch(e){ foteVersionState.latest=null; foteVersionState.message='Could not check for updates. You can keep playing this copy.'; }
    finally{ if(timer)clearTimeout(timer); foteVersionState.pending=null; paintVersionStatus(); }
  })();
  return foteVersionState.pending;
}
function showVersion(){
  var html='<p id="versionPanelStatus" role="status"></p><button id="versionInstall" hidden>Install update</button><button id="versionCheck">Check again</button>';
  FOTE_PATCHES.forEach(function(p){ html+='<section><h3>'+p.version+'</h3><ul>'+p.notes.map(function(n){return '<li>'+n+'</li>';}).join('')+'</ul></section>'; });
  openModal('Version',html,[{label:'Close',fn:closeModal}]);
  document.getElementById('versionInstall').onclick=function(){forceUpdate(this);};
  document.getElementById('versionCheck').onclick=checkGameVersion;
  paintVersionStatus();
}
async function forceUpdate(btn){
  await checkGameVersion(); var b=foteVersionState.latest; if(!b)return;
  if(btn){btn.disabled=true;btn.textContent='Installing…';}
  try{
    if(navigator.serviceWorker){var regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.filter(function(r){return r.scope===new URL('./',location.href).href;}).map(function(r){return r.unregister();}));}
    if(window.caches){var ks=await caches.keys();await Promise.all(ks.filter(function(k){return k.indexOf('astra-temple-')===0;}).map(function(k){return caches.delete(k);}));}
    var url=new URL(location.href);url.searchParams.set('b',b.built);location.replace(url.href);
  }catch(e){ if(btn){btn.disabled=false;btn.textContent='Retry update';} foteVersionState.message='Update could not be installed. Please try again.';paintVersionStatus(); }
}
/* Installed apps may return from suspension without rebuilding the title menu. */
document.addEventListener('visibilitychange',function(){var t=document.getElementById('title');if(!document.hidden&&t&&t.classList.contains('on'))checkGameVersion();});
window.addEventListener('load',function(){var t=document.getElementById('title');if(t&&t.classList.contains('on'))checkGameVersion();});
