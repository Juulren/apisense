import { router, type Href } from "expo-router";

/**
 * For entering or leaving a session: goes to `href` and forgets the way here.
 * `replace` alone only swaps the top screen, so the ones underneath (welcome,
 * login, the last session's screens) would come back with Android's back.
 */
export function startAt(href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
