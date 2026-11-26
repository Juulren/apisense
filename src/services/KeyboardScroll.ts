/**
 * Where a list must scroll so the focused field shows above the keyboard, or null
 * when it already does. All positions are window coordinates; `offset` is the
 * list's current scroll. It moves as little as possible: React Native's own helper
 * ignores the current scroll and the list's position, and jumps back up.
 */
export function scrollToReveal({
  offset,
  inputTop,
  inputHeight,
  viewTop,
  viewBottom,
  margin,
}: {
  offset: number;
  inputTop: number;
  inputHeight: number;
  viewTop: number;
  viewBottom: number;
  margin: number;
}): number | null {
  if (
    ![offset, inputTop, inputHeight, viewTop, viewBottom].every(Number.isFinite) ||
    inputHeight <= 0 ||
    viewBottom <= viewTop
  )
    return null;
  const hiddenBelow = inputTop + inputHeight + margin - viewBottom;
  const roomAbove = inputTop - margin - viewTop;
  // A field taller than the space keeps its start in view.
  const delta =
    hiddenBelow > 0
      ? Math.min(hiddenBelow, roomAbove)
      : Math.min(roomAbove, 0);
  return delta === 0 ? null : Math.max(0, offset + delta);
}
