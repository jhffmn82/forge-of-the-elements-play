/* =====================================================================
   surprise.js - "!" surprise openings, Pixel Dungeon style (2026-09-17).
   When an unaware enemy notices you, a gold "!" shows over it. Noticing does
   not spend its action; until it acts again your attacks are surprise attacks.
   A searching step that finds you grants another opening, as does finding
   you at the start of an action after two unseen actions. The
   creature takes its normal action first, then notices from its new position;
   reacquisition never spends an extra action.
   ===================================================================== */

var SURPRISE_LOST = 2;   /* its own unseen actions before another surprise opening */


/* hitting it clears the opening: one surprise attack per "!" */
