import { useCallback } from "react";
import { useFocusEffect, type Href } from "expo-router";
import { startAt } from "../state/startAt";

/**
 * For a screen that must send the person elsewhere because the session changed:
 * like <Redirect>, but without leaving the old screens behind it.
 */
export function StartAt({ href }: { href: Extract<Href, string> }) {
  useFocusEffect(
    useCallback(() => {
      startAt(href);
    }, [href]),
  );
  return null;
}
