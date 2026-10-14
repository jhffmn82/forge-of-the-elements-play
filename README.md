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

The phone rendering update raises the stationary scene target to 60 Hz while
keeping effect speeds unchanged, batches exact animation imports, and reuses
lighting textures. It also avoids unused lighting and black-bloom work. Automated
checks preserve game state; overall physical-phone speed
still needs device testing.

Block mode now uses traditional roguelike symbols with clearer objects, creatures,
hazards and remembered terrain. Options includes a symbol guide. Holding to inspect
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

Keyboard: WASD or arrows to move, QEZC diagonals, 1-8 hotbar, Tab character sheet,
`i` equipment, `>` stairs. Mouse and phone touch controls remain available.

On a phone, open the play link in a browser. Portrait and landscape are supported;
tap to move and hold to inspect. Touch controls and High Contrast are in Options.
The existing Android APK wrapper has not been rebuilt for this web update.

This repository contains generated public output. The source checkout provides
the repeatable export and an itch.io ZIP. Automated browser tests cover gameplay,
save compatibility, UI, dimensional compositing, recovery and nested-path play.
Physical-phone GPU and memory performance still require device testing.

Build: **2026-10-14T19:41:05.873Z**. Revision: `foundation17-20261014194105873`.

Source integration: `9ee99300ea598a6026eff77a3f500240613ac5a6`.
