/* Scene preparation for the original renderer. Caches are presentation-only.
 * Bake the first visible natural-terrain frame before returning control to the
 * browser, so a floor transition never exposes the progressive flat placeholders.
 */


/* Named floor-generation stages; ordered by generation-adapter.js. */
function repairGeneratedMemorials(){repairWallMemorials();return;}
