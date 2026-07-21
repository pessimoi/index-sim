export function globalStatusAnnouncement(
  status: string,
  pendingUndo: { label: string } | null,
  visibleLiveMessages: readonly (string | null | undefined)[] = []
): string {
  return pendingUndo?.label === status || visibleLiveMessages.includes(status) ? "" : status;
}
