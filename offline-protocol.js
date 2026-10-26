/* The offline copy's names, in one place (consolidation A1): the service worker (sw.js, importScripts) and the page
 * (src/platform/offline.js and version.js, bundled) read the same table. A classic script, not a module, so the
 * worker loads it everywhere a service worker runs; it sets self.FORGE_OFFLINE (globalThis in Node tests).
 * A release copy ships it next to sw.js (tools/assets/stamp-build.mjs checks). */
(function (g) {
  g.FORGE_OFFLINE = Object.freeze({
    PREFIX: 'forge2-',                  // every cache this game owns starts with it (Install update clears them all)
    CACHE: 'forge2-v1',                 // the control cache: network-first copies, the active revision, client builds
    REVISION: 'forge2-revision-',       // + encodeURIComponent(build): one complete stored revision per build
    POINTER: '__forge_offline_revision__',   // in the control cache: { built } of the active revision
    CLIENTS: '__forge_offline_client__/',    // in the control cache: + client id -> { built } of that page
    RECEIPT: '__forge_offline_complete__',   // in a revision: { built }, written last, so a half-stored one has none
    VERIFY: 'forge-offline-verify',          // ?<this>=<build> always goes to the network and is marked
    VERIFIED: 'X-Forge-Offline-Verified',    // the mark, a response header carrying the build
    CLIENT_MESSAGE: 'forge-offline-client',  // page -> worker: { type, built }
  });
})(typeof self !== 'undefined' ? self : globalThis);
