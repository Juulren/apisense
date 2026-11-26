/** The home screen's greeting, by the phone's local time. */
export function greetingFor(now: Date) {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}
