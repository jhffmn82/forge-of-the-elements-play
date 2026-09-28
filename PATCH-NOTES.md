# Forge of the Elements: Beta 1.3.1 hotfix

Running notes, updated with each change as it lands on `hotfix/1.3.1`. At release these fold into the in-game patch history (`FOTE_PATCHES` in `js/update.js`) when `FOTE_VERSION` moves to Beta 1.3.1.

## Graphics and presentation

- The Crypt Shambler is now a clearer fantasy zombie, with new idle, shambling walk, clawing attack and collapse animations. Its revival and fallen body work as before.
- The Dungeon Rat has new art: a scruffy brown rat with its own idle, snarling lunge-bite, flinch and collapse animations, the same length on the map as before and without the pale outline. The Cave Rat shares it.
- Floor skulls and bone piles are now half their original size, so they sit on the floor as scenery instead of dominating the tile. Their placement and footprint are unchanged.
- Weapons, shields, tomes, orbs and holy symbols are sharp on the map and on the Equipment doll, including close zoom, high-resolution screens and phones. Held gear no longer smears when shown large or shimmers when shown small.
- The Equipment doll is drawn in one clean pass and keeps its full size. In a wide window a two-handed axe now shows its whole blade, and on phones the Gear tab gives the character its own space, so the main-hand weapon and the full shield are visible.
- Held gear stays in the hand: a sword no longer flips across the body for a frame mid-walk, a shield no longer drops to the hip mid-spell, and a shield or focus no longer hides behind the character while standing or walking.
- Icons in the worn slots, the bag and the hotbar are painted at the size they are shown, so they stay crisp on every screen. Rings and amulets now show at their true size beside weapons instead of being blown up and blurred.
- Shooting a bow no longer draws your sword, axe or shield over the bow in your hands. Melee gear is put away for the shot and comes back when it ends.
- The staff in your hand now wears the gem-topped head from its icon on the same wooden shaft, with a clean dark outline, so it reads as a staff on the map and the Equipment doll instead of a plain stick.
- The Ceremonial Knife in a cleric's hand is now a clear bone knife that matches the other weapons, instead of a few grey specks floating above the fist.
- Starting tomes, holy symbols, orbs, staves and wands keep their own colours on the character instead of turning grey, so they match their icons.
- Body armor is no longer painted onto your character as a flat patch of colour over the chest. Every character now shows their own outfit as drawn; an enchanted armor still gives a soft glow of its element around the figure.
- The glow around an enchanted weapon is the same size on every screen. On phones it was about a third as large, and on high-resolution displays about half.
- The character creation preview now shows your starting kit: the weapon, shield or focus in hand and the armor you will wear, drawn the same crisp way as the Equipment doll.
- Followers of Chad the Unclad hold their Holy Symbol in the hand on the Equipment doll and in the creation preview, instead of it floating at the hip.
- Traps, props, chests and set pieces now finish loading before the game appears. Continuing a save, entering a new biome or spotting your first trap no longer shows their old artwork for a moment before the new art.
- Painted spark, teleport and fire, gas and frost vent traps no longer have the old zigzag, rune rings, glow and wisps drawn over them. A vent hidden under a brazier or other prop still gives off its glow.
- If the trap and prop artwork fails to download, the loading screen's Retry button now fetches it again instead of leaving the old art in place.
- Goblins, their archers, shamans, brutes and Warchief, and the Shambler now show their new animated art from the first sighting, including remains in a continued save, instead of briefly showing the old sprites.
- The Unmaker's Discord Prism pylons are animated from the moment they appear, instead of first showing as still crystals.
- Every biome's floor and wall artwork now loads on the loading screen with the rest of the game's art, the Realm of Chaos included, so the Crypt, the Underdark, the elemental planes and the Realm of Chaos no longer appear in their old floor and wall art first, and nothing downloads while you play. The loading screen takes longer as a result.
- If a floor's artwork is ever still missing when you arrive, the previous view stays on screen (the title screen when continuing) and your moves wait until it is ready, instead of showing the old art.
- The Caverns rope bridges and the forge in the Unmaker's Crucible now show their new art from the start.
- Caverns, plane and Underdark rock no longer stays blocky in patches, or flicks back to blocky, on phones, at wide zoom or with the map revealed. Once the detailed stone has appeared, it stays.
- Entering the Fire, Water or Air plane no longer shows flat colour squares for a moment.
- Torch stands, soul braziers and candelabras now show only their own painted flames, with a soft flicker, instead of a second blocky flame drawn on top. Lit braziers keep their animated flame.
- Props and traps outside the view are no longer drawn every frame, so explored floors are lighter to render, especially on phones.
- Crates, barrels, pots, statues, carts, cages and candle tables no longer have an old dark outline and speckled moss baked onto their new art, and the Crypt's urns keep their painted colours and edges.
- Plants are no longer washed grey, so their painted greens come through.
- Dungeon grass now sits on a single soft moss bed drawn at full detail, instead of two stacked shade layers with a blocky speckle.
- In the Crypt, floor grime and green ooze now lie under traps, mushrooms, bones and props instead of being painted over them, and grime on remembered floor fades like the floor it is on.
- The square dark band along the foot of every wall, and the dark strips painted at the ends of wall faces, are gone; the painted walls and the lighting shade their own bases. Block Art keeps its band.
- Chasm edges in the Dungeon now take the colour of the new warm floor stone instead of the old grey, and the Crypt's match its floor more closely.
- With Lighting off, remembered floor no longer shows a faint lighter grid, and floor tiles no longer leave hairline seams at some zoom levels and screen scales: each tile now covers exactly its own screen pixels.
- An opened door keeps its look: iron doors open onto their iron leaf, spiked and thorn-grown doors onto their wooden leaf, and melted ice, crystal and Crypt doors leave a bare stone arch, instead of every door turning into the same wooden one.
- Goblins, the Shambler and the Realm of Chaos foes no longer have a pale outline drawn around them; their new art has its own dark edge. Older creatures keep the outline.
- A dying creature is lit like everything around it, so its body no longer glows brighter while it falls and then darkens when it lands.
- Long fights no longer keep adding to memory use through creature outlines and hit flashes.
- The Dungeon's floor stones no longer line up with the rows of map tiles, so the floor no longer shows a dark line along every row. They are the same painted stones, a little smaller.
- Painted traps now sit at the size and place their artwork was drawn for, instead of being squeezed into the old plate outline. The teleport rune is no longer squashed, fire and gas vents fill their tile, and the alarm tripwire lies across the floor.
- A Shambler that collapses no longer shows two bodies for a moment, and its fallen body now lies facing the way it fell.
- Grukk the Warchief's turn no longer lingers for a moment after his attack has finished.
- With Motion turned off, goblins and the Shambler now behave like the other Dungeon and Crypt creatures: still at rest, while their attacks and collapse still show.
- The game downloads about 0.8 MB less old creature and portrait artwork before it starts; goblins and the Shambler now come only from their new animated art.
- Chests, Underdark set pieces, plants and mushroom and urn clusters now come only from their new artwork, so none of them can briefly show an older version while loading. The game also downloads about 0.4 MB less old artwork before it starts.
- A floor is now built the same way whether or not its artwork has finished loading. Crypt candles, grave posts, urns, tombs and wall fungus, crystal vault markers and plane scatter no longer go missing or change places on a slow connection, so a seed always makes the same level.
- New art for every Fae and Gloomling character: all four Fae courts, male and female, now wear practical clothes in their court's colours, and the Gloomlings have their new look. Each has a fresh idle, walk, spellcast, bow shot, melee strike, flinch and fall, and appears the same way on the map, the Equipment doll, the character creation preview and your Shadow Clone.
- Gloomling followers of Chad the Unclad have new underwear art and animations to match. Fae followers keep their current underwear look. Every follower's underwear art now loads with the rest of the game, so it shows from the first moment instead of a stand-in figure.
- The new Fae and Gloomling bow shot is drawn with your own bow in hand, held upright with the string toward you, and your sword, shield or focus are put away for the shot as before.
- Charge has a new icon: a shield with a gold impact flash, instead of a small running figure.
- Fine and Masterwork weapons and shields no longer glow blue or gold on your character; they are drawn as painted. Worn gear still looks dull.
- Essence crystals are now violet, so they no longer look like the blue mana globes on the floor. In Block Art essence is a violet dot too.

## Interface

- Stacked items on the hotbar show how many you carry in the corner of the slot, on desktop and touch. The number updates as soon as you use, pick up or drop one, and disappears when only one is left.
- Your worn amulet can be dragged from the Equipment sheet onto any hotbar slot. The amulet's slot also accepts items and other slots dropped onto it again.
- Drag any hotbar slot (ability, prayer, item or amulet) off the bar and let go to remove it. Nothing is unequipped or dropped, and a removed ability or prayer stays off the bar until you drag it back from the Character or Faith sheet. Swapping slots, right-click and the touch long-press Remove work as before.
- Drag an item out of the inventory window and let go over the map (or anywhere that is not another slot) to drop it on the ground. It is the same as the Drop command: same turn cost, same rules. A short drag, or letting go back inside the window, never drops anything.
- Descriptions across the game were reviewed and rewritten for clarity and accuracy, with no em dashes. Spells, prayers, gear, sigils, statuses and hints now say plainly what they really do.
- The Unmaker's card (hover over the boss, or press and hold it on a touchscreen) now shows a short tip for fighting its current form: the Crowned Tyrant, the Unbound or the Heart of Discord. The tips were written for the fight but never appeared on the card.
- The browser tab now shows the game's icon.
- On a phone turned sideways, the title menu sits below the "Forge of the Elements" logo instead of covering it, with its buttons sized to fit the screen.
- The hotbar has a new look: each slot is a dark well with the ability's colour as a soft glow inside it, and every icon sits on a shadow so it stands out.
- A hotbar skill or prayer on cooldown now greys out, shows a dark clock sweep for the time still to run and a large turn count in the middle, and flashes gold once when it is ready again.
- The level bar shows just your level (LV 15) instead of also printing your experience numbers, so it stays on one line on small screens. Hover it to see the exact experience.

## Gameplay and balance

- Prayers and god invocations now have cooldowns, each its own: single-target buffs wait about half again their base duration, single-target divine attacks wait 2 turns, area prayers 8, and summons, heals and other utility prayers 20. Invocations that are not buffs, including Saint Glimmer's Heal, have no cooldown. A Holy Symbol still lengthens buffs but never the wait. The hotbar, hover card and Faith tab show "ready in N" while you wait.
- Chad the Unclad: each landed punch now grants 0.3 piety instead of 1, so rank comes from sustained fighting rather than a handful of hits. Unarmed kills still pay their full piety reward.
- Dwarves' armor now counts as one upgrade higher, like their weapons always did: +1 armor on any armor, plus +2 evasion in leather and +3% spell damage in a robe. The old flat +1 armor that applied even with no armor on is gone, and the race description now says what the bonus really is.
- Only attacks pause the game now. Monsters that move on the same turn all step at once instead of one after another, so a room full of wandering monsters takes about the time of a single step instead of one step per monster. Swings, spells, arrows and falling creatures still play one at a time, in turn order, and a monster that steps up and attacks in the same turn finishes its step before it swings.
- The Tide Crab can always be beaten now. Its shell still takes the first blow of each turn, but after three blows it cracks and every hit lands. Before, a character landing one attack a turn could never hurt it. Its card now explains the shell.
- The Deep Maw no longer leaves you alone between eruptions: each time it bursts out of the ground it calls up a Worm Tender, a myconid of its brood in the Maw's own earth-brown and bruised pink, beside one of its burrow mounds. Only one is alive at a time. It fights exactly like a Myconid, with the same poisoning, slowing spores and Shroomlings, gives experience and counts for kill effects like any other foe but drops no loot, and when the Maw dies it sinks back into the ground with its Shroomlings and its spore clouds settle. The Maw's card and its own say so.
- Enemies that other creatures call up in a fight (the Deep Maw's Worm Tender, Shroomlings, raised skeletons and Shamblers, the Matron's spiderlings and driders, Chaos offspring, split slimes and the like) now give experience and count as kills for your god: piety, favor and on-kill boons such as Mother Murk's healing all work on them. They still drop no loot, so a summoner cannot be farmed for items.

## Performance and fixes

- The game is about a third smaller to download (180 MB down to 122 MB): artwork now ships in a smaller lossless image format and the music uses a lighter encoding, so first loads, offline installs and updates finish sooner.
- Mother Murk's Grave Strength now applies once per attack by your servant or summons. A summon's elemental follow-up hit no longer adds the extra shadow damage and your weapon's enchantment a second time.
- Playing in a browser no longer downloads the entire game in the background; only the installed app and the Android app keep a full offline copy. A slow connection now says it is still loading instead of looking frozen, and offers a Reload button only if nothing at all arrives for a full minute.
- Monsters you cannot see no longer hold up the game. A wanderer setting off a trap or taking poison damage out of sight, or anything moving or fighting off the edge of the screen, no longer delays your next move or the monsters you can see.
- Wandering monsters now work out their routes with about half the work, so a turn on a floor with many wanderers takes about a third less time, especially noticeable on phones. They choose exactly the same routes as before.
- A busy turn is drawn once instead of once for every visible monster that moves, which also saves time on phones.
- On slower phones, a floor full of wandering monsters no longer makes your hero or the monsters you can see skip part of a step. Every step now slides the whole way, starting as soon as the monsters have all chosen their moves.
- Returning from an elemental plane to the Underdark, or going up and back down the stairs there, no longer breaks the floor's drawing, stops the animations, leaves the plane's music playing or skips the autosave.
- Entering the Caverns, the Underdark's caves or an elemental plane, and stepping through a portal to another Chaos island, is now close to instant: the rock and ground appear fully detailed in the very first frame instead of sharpening in over several seconds (up to 10 to 17 seconds on slower phones). Nothing about how they look has changed.
- Walking through caves and planes no longer shows blocky or flat squares at the edge of the view. The ground ahead of you is prepared in the background, on your device's spare processor cores.
- Walking into the Dungeon's grassy rooms no longer hitches while the moss bed under the grass is drawn: each patch is built about twice as fast, and the patches just outside the view are prepared ahead of time while the game is idle. The moss looks exactly the same.
- Every frame does far less work, so a slower computer or a phone keeps up while you walk: the lighting setting and the map are read once a frame instead of once per tile, the light map works tile by tile, and the floor, walls and still ground cover (moss, grime, chasm edges, water beds) are drawn once and reused while they stay the same, instead of being redrawn 30 to 60 times a second. Water glints, ooze, swaying plants, flames and every creature stay animated, and a still picture looks the same as before. On a computer four times slower than a desktop, a frame takes a quarter to a half less time to draw depending on the biome, and hitches longer than a tenth of a second are cut by 30 to 80 percent.
