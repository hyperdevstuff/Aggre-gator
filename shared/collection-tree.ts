/** Root collections are level 1. Shared by the API and the parent picker. */
export const MAX_COLLECTION_DEPTH = 3;

export type CollectionNode = {
  id: string;
  parentId?: string | null;
  isSystem?: boolean;
};

export function collectionDepth(id: string, nodes: readonly CollectionNode[]): number {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  let current: string | null | undefined = id;
  let depth = 0;
  while (current) {
    const node = byId.get(current);
    if (!node || visited.has(current)) return Infinity;
    visited.add(current);
    depth += 1;
    current = node.parentId;
  }
  return depth;
}

/** Validate a new parent against the entire moving subtree, not just its root. */
export function collectionParentError(
  nodes: readonly CollectionNode[],
  parentId: string | null,
  movingId?: string,
): string | undefined {
  const parent = nodes.find((node) => node.id === parentId);
  if (parentId && !parent) return "Parent collection not found.";
  if (parent?.isSystem) return "System collections cannot contain sub-collections.";

  const descendants = new Set<string>();
  let height = 1;
  if (movingId) {
    let level = [movingId];
    while (level.length) {
      for (const id of level) {
        if (descendants.has(id)) return "Collection hierarchy contains a cycle.";
        descendants.add(id);
      }
      const next = nodes.filter((node) => node.parentId && level.includes(node.parentId)).map((node) => node.id);
      if (next.length) height += 1;
      level = next;
    }
  }
  if (parentId && descendants.has(parentId)) {
    return "A collection cannot be moved into itself or its descendants.";
  }
  const parentDepth = parentId ? collectionDepth(parentId, nodes) : 0;
  if (parentDepth + height > MAX_COLLECTION_DEPTH) {
    return "Collections can be nested up to 3 levels, including all sub-collections.";
  }
  return undefined;
}
