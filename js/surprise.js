/* =====================================================================
   surprise.js - "!" surprise openings, Pixel Dungeon style (2026-09-17).
   When an enemy notices you, or finds you again after losing sight of you for a couple of its turns
   (you closed a door, broke line of sight round a corner), a gold "!" shows over it. Noticing costs it
   that action, and until it acts again your attacks against it are surprise attacks.
   ===================================================================== */

var SURPRISE_LOST = 2;   /* its own actions without sight of you before finding you again counts */


/* hitting it clears the opening: one surprise attack per "!" */
