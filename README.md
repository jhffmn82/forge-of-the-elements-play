# Forge of the Elements

**Beta 1.7 dimensional-lighting playtest.**

[Play in your browser](https://jhffmn82.github.io/forge-of-the-elements-play/)

This update integrates dimensional lighting with a refactored foundation based on
released 1.6. Existing gameplay rules, balance, controls, interface layouts, sprite art,
audio, fonts and save format are preserved. Lighting is enabled by default, with
a Canvas fallback when WebGL2 is unavailable. Block art remains in Options.
The update also fixes cross-floor fire attribution and releases retired Chaos
art from animation caches.
Character creation stays visible until the chosen hero and floor are drawn;
artwork Retry remains available while a floor is loading.

The phone rendering update raises the stationary scene target to 60 Hz while
keeping effect speeds unchanged, batches exact animation imports, and reuses
lighting textures. It also avoids unused lighting and black-bloom work. Automated
checks preserve game state and sprite pixels; overall physical-phone speed
still needs device testing.

Block mode now uses traditional roguelike symbols with clearer objects, creatures,
hazards and remembered terrain. Options includes a symbol guide. Holding to inspect
on touch screens no longer issues an accidental command on release. The HUD face
becomes a race-colored `@`, with elemental court colors for Fae; switching to
Sprites restores animated portraits. Cold Blocks startup skips unused scene and
portrait artwork. Native movement, combat, visibility and saved runs are retained.

Keyboard: WASD or arrows to move, QEZC diagonals, 1-8 hotbar, Tab character sheet,
`i` equipment, `>` stairs. Mouse and phone touch controls remain available.

On a phone, open the play link in a browser. Portrait and landscape are supported;
tap to move and hold to inspect. Touch controls and High Contrast are in Options.
The existing Android APK wrapper has not been rebuilt for this web update.

This repository contains generated public output. The source checkout provides
the repeatable export and an itch.io ZIP. Automated browser tests cover gameplay,
save compatibility, UI, dimensional compositing, recovery and nested-path play.
Physical-phone GPU and memory performance still require device testing.

Build: **2026-10-10T23:53:03.259Z**. Revision: `foundation17-20261010235303259`.
