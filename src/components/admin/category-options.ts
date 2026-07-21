/**
 * Parent-picker options for the category form.
 *
 * Shared by the create and edit pages so both label nesting the same way
 * (`Women → Dresses`) and both apply the same exclusion rule. Lives outside the
 * form component because that file is a client component and this runs on the
 * server, and outside the action modules because every export from a
 * `"use server"` file must be an async server function.
 */
export type CategoryNode = { id: number; parentId: number | null; name: string };

/** Ids of `rootId` and everything beneath it. */
export function subtreeIds(nodes: CategoryNode[], rootId: number): Set<number> {
  const childrenOf = new Map<number, number[]>();
  for (const n of nodes) {
    if (n.parentId === null) continue;
    const list = childrenOf.get(n.parentId) ?? [];
    list.push(n.id);
    childrenOf.set(n.parentId, list);
  }

  const ids = new Set<number>();
  const queue = [rootId];
  // Breadth-first with a seen-set, so malformed data cannot loop forever.
  while (queue.length > 0) {
    const id = queue.shift() as number;
    if (ids.has(id)) continue;
    ids.add(id);
    queue.push(...(childrenOf.get(id) ?? []));
  }
  return ids;
}

/**
 * Options in tree order, labelled with their ancestry. Pass `excludeId` when
 * editing: that category and its descendants are dropped, because either would
 * make the category its own ancestor.
 */
export function parentOptions(
  nodes: CategoryNode[],
  excludeId?: number,
): { id: number; name: string }[] {
  const excluded = excludeId ? subtreeIds(nodes, excludeId) : new Set<number>();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const label = (node: CategoryNode): string => {
    const parts = [node.name];
    let cursor = node.parentId;
    for (let hops = 0; cursor !== null && hops < 20; hops++) {
      const parent = byId.get(cursor);
      if (!parent) break;
      parts.unshift(parent.name);
      cursor = parent.parentId;
    }
    return parts.join(" → ");
  };

  return nodes
    .filter((n) => !excluded.has(n.id))
    .map((n) => ({ id: n.id, name: label(n) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
