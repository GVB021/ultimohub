type TakeBase = {
  id: string;
  lineIndex: number;
  voiceActorId: string;
  isPreferred?: boolean | null;
  createdAt?: Date | string | null;
};

export function annotateTakeVersions<T extends TakeBase>(takesList: T[]) {
  const byActorAndLine = new Map<string, T[]>();
  for (const take of takesList) {
    const key = `${take.voiceActorId}::${take.lineIndex}`;
    if (!byActorAndLine.has(key)) byActorAndLine.set(key, []);
    byActorAndLine.get(key)!.push(take);
  }
  const versionById = new Map<string, number>();
  Array.from(byActorAndLine.values()).forEach((list: T[]) => {
    list
      .sort((a: T, b: T) => new Date(String(a.createdAt || 0)).getTime() - new Date(String(b.createdAt || 0)).getTime())
      .forEach((take: T, idx: number) => versionById.set(take.id, idx + 1));
  });
  return takesList.map((take) => ({
    ...take,
    takeVersion: versionById.get(take.id) || 1,
    status: take.isPreferred ? "approved" : "pending",
  }));
}
