/** es-AR date/time formatting helpers shared across list and detail views. */

export function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
