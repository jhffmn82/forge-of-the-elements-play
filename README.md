# Forge of the Elements

**Beta 1.7 dimensional-lighting playtest.**

[Play in your browser](https://jhffmn82.github.io/forge-of-the-elements-play/)

This update integrates dimensional lighting with a refactored foundation based on
released 1.6. Original sprite artwork, audio and compatible saves remain.
The accepted 1.7 gameplay and UI fixes are included. Lighting is enabled by default, with
a Canvas fallback when WebGL2 is unavailable. Block art remains in Options.
The update also fixes cross-floor fire attribution and releases retired Chaos
art from animation caches.
Character creation stays visible until the chosen hero and floor are drawn;
artwork Retry remains available while a floor is loading.

Creation now uses 126 painted figures covering 216 looks, with consistent
line-up and preview sizes on desktop, tablets and phones. Paintings decode
before appearing, failed artwork can recover on a later visit, and the original
sprite fallback remains available. Secondary buttons are darker, status rims
are bronze, and the tutorial toggle clearly shows its state. Letter keys ignore
case while preserving assigned shortcuts; Double Strike faces its target.
The displayed race name is Dwarve; existing save keys are unchanged.
The export carries the unchanged paintings in 18 small resource packs and
decodes only requested figures, keeping the complete build at 948 files.

The phone rendering update raises the stationary scene target to 60 Hz while
keeping effect speeds unchanged, batches exact animation imports, and reuses
lighting textures. It also avoids unused lighting and black-bloom work. Automated
checks preserve game state; overall physical-phone speed
still needs device testing.

Block mode now uses traditional roguelike symbols with clearer objects, creatures,
hazards and remembered terrain. Holding to inspect
on touch screens no longer issues an accidental command on release. The HUD face
becomes a race-colored `@`, with elemental court colors for Fae; switching to
Sprites restores animated portraits. Cold Blocks startup skips unused scene and
portrait artwork. Native movement, combat, visibility and saved runs are retained.

The Journal keeps achievements, discoveries, the bestiary and run history across
save slots. Search names nearby objects and creatures in the normal log. Fixed
species stats match the bestiary, and two-handed equipment recovers hidden offhand
items. Block identities use distinct symbols and colors; portrait inspection cards
stay clear of controls. Recent combat messages fade after three seconds of silence.

The approved lighting review gives sprites directional form and grounds their
softer shadows through animation and lunges. Sprite bodies stand within their
tiles, with pointer targeting following the visible body. Torch flicker, mushroom
pulses and local illumination remain. Visible arrivals wait for required sprite
art instead of flashing block stand-ins; failed optional normal maps no longer
block play. Rendering changes reduce repeated shadow work and large filtered
composites, with measured desktop gains and physical-phone testing still needed.

The latest biome refinements smooth natural terrain and explored fog boundaries,
texture Chaos cliff undersides, raise cavern formations, and improve creature
shadow anchors. Underdark lighting is darker and more localized; red plants,
mineral veins and temple grout cast restrained colored glow. Creature inspection
text is larger and tall cards scroll on touch screens. Caverns Rock Slimes use
the original Rock Slime artwork and healing/splitting behavior with stronger
Caverns stats, including migration of existing creatures in saved games.

Launch polish adds new opening footage, stronger spell effects and standing
auras, regional shadow colors, re-laid masonry floors, cooling-lava grout and
natural Chaos pools. Major casts have time to play their effects; infusing an
element has a visible power-up sequence. Upheaval raises a temporary rock ridge,
and Shades can pass through it. Approved fixes cover teleport destinations,
Umbral Passage, sigils, Double Strike targeting, achievement notices, save
overwrite confirmation and short-screen controls. Existing saved runs remain
supported. The separate promotional trailer is uploaded by the game creator.

The lighting follow-up corrects dark bands across lamp-lit character heads and
aligns spell/bow target marks around whole creatures, including multipart bosses.
Earth has natural mineral ribbons instead of closed polygon veins. Opaque natural
terrain shares lighting batches to reduce mask uploads and draw calls.

The approved interface update adds drawn steel windows and action plates,
progressive character creation with explicit confirmation, larger primary
actions, and bundled Grenze Gotisch and Spectral fonts. Options retains the
controls tour and text sizing; Save / Exit has its own entry in the overlay
menu. Equipment changes follow the creator's item-by-item rulings. Unused
interface art and obsolete styling were removed after appearance checks.

The export preserves script order and boundaries while packing loose modules
into one download.

Continue keeps the saved hero on a bright second line, long names stay inside
the plate, and the bag has visible dotted slot boundaries. Creation retains
the chosen god when revisited; attributes and history controls retain their
approved layout and behavior.

The October 15 update smooths near-60-Hz frame pacing, reuses standing-creature
shadows, corrects the material gateway's light, and makes four plane centerpieces
solid. Existing plane saves move overlapping actors and dropped loot safely.
The title opens before hidden preview art finishes; background offline copying
waits for a visible run and pauses while menus or floor loading are active.

Approved loot changes reduce early surplus, use four equally likely build pools,
split armor among heavy/leather/cloth, and advance quality by biome. Biome four
gear is Masterwork; duplicate Masterworks reroll once while allowing wanted pairs.
Equipment movement and repeated pickup count each physical Masterwork only once.
Save/update/offline and focused gameplay/rendering checks passed. Physical-phone
frame rate still requires device testing. Low-power and offline-delta work remain
outside this build.

The window update reorganizes Character, Inventory, Faith, Options, creation,
Journal and the Forge into compact layouts with named abilities and inspection
cards. Drawn tabs, close controls and segmented frames fit desktop, tablet and
phone views. Equipment passives remain visible on Character; learned spells
stay on the hotbar through repeated Forge visits. Keyboard creation inspection,
small-phone Forge labels and hidden-actor beacon visibility are corrected.
Music Off avoids loading a new score, and touch devices retain fewer decoded
music tracks. The Options map legend and HUD color/transparency controls were
removed under the creator's approved redesign.

Character and Inventory now keep full stat labels readable, including Large text.
Narrow mouse-input windows keep the menu header, worn gear and bag separated.

Source integration: `1086bac46dfcbad7171bd817e8436684e65e3dbe`.

Keyboard: WASD or arrows to move, QEZC diagonals, 1-8 hotbar, Tab character sheet,
`i` equipment, `>` stairs. Mouse and phone touch controls remain available.

On a phone, open the play link in a browser. Portrait and landscape are supported;
tap to move and hold to inspect. Touch controls and High Contrast are in Options.
The existing Android APK wrapper has not been rebuilt for this web update.

This repository contains generated public output. The source checkout provides
the repeatable export and an itch.io ZIP. Automated browser tests cover gameplay,
save compatibility, UI, dimensional compositing, recovery and nested-path play.
Physical-phone GPU and memory performance still require device testing.

Build: **10/15/2026 22:28:30**. Revision: `foundation17-20261015222830243`.

Fae Cleric warnings now follow the chosen court. Ability icons share their
existing chip colours and wait for slow artwork through the native loader.
Small-phone stat pairs have more separation. Into the Dark requires no
adjacent enemies and refuses before cost, cooldown or turn advancement.
The title and Choose your adventurer use the approved warm ivory lettering.

Creation and windows now keep opaque panel faces while their artwork loads.
Floor entry waits for environment metadata and the selected art before exposing
the scene, with native Retry retained. Generic Invoke uses a simple neutral
spark; Character, Faith and creation ability backplates use 25% fill alpha
while their icon artwork remains opaque.
The Character header aligns the name and race/class/patron on their text
baseline while retaining its existing phone wrapping.
