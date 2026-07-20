export function globalStatusAnnouncement(
  status: string,
  pendingUndo: { label: string } | null
): string {
  return pendingUndo?.label === status ? "" : status;
}
