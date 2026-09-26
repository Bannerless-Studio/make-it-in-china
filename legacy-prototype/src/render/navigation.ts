export interface Cell { col: number; row: number }
export type Grid = boolean[][];

export function makeGrid(size: number): Grid {
  return Array.from({ length: size }, () => Array<boolean>(size).fill(true));
}

export function worldToCell(x: number, z: number, size: number): Cell | null {
  const col = Math.floor(x + size / 2);
  const row = Math.floor(z + size / 2);
  return col >= 0 && row >= 0 && col < size && row < size ? { col, row } : null;
}

export function cellToWorld(cell: Cell, size: number): [number, number] {
  return [cell.col - size / 2 + 0.5, cell.row - size / 2 + 0.5];
}

export interface WaypointNode { id: string; position: [number, number]; neighbors: string[] }

export function findWaypointPath(
  waypoints: WaypointNode[],
  startId: string,
  goalId: string,
): string[] {
  if (startId === goalId) return [startId];
  const nodes = new Map(waypoints.map(node => [node.id, node]));
  if (!nodes.has(startId) || !nodes.has(goalId)) return [];
  const dist = new Map<string, number>([[startId, 0]]);
  const prev = new Map<string, string | null>([[startId, null]]);
  const unused = new Set(nodes.keys());
  while (unused.size) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of unused) {
      const d = dist.get(id) ?? Infinity;
      if (d < best || (d === best && (current === null || id < current))) {
        best = d;
        current = id;
      }
    }
    if (current === null || best === Infinity) break;
    unused.delete(current);
    if (current === goalId) break;
    const node = nodes.get(current)!;
    for (const neighborId of [...node.neighbors].sort()) {
      const neighbor = nodes.get(neighborId);
      if (!neighbor) continue;
      const weight = Math.hypot(
        node.position[0] - neighbor.position[0],
        node.position[1] - neighbor.position[1],
      );
      const next = best + weight;
      const existing = dist.get(neighborId) ?? Infinity;
      const better = next + 1e-9 < existing
        || (Math.abs(next - existing) < 1e-9 && current < (prev.get(neighborId) ?? '\uffff'));
      if (better) {
        dist.set(neighborId, next);
        prev.set(neighborId, current);
      }
    }
  }
  if (!prev.has(goalId) && startId !== goalId) return [];
  const path: string[] = [];
  for (let at: string | null = goalId; at; at = prev.get(at) ?? null) {
    path.push(at);
    if (at === startId) break;
  }
  return path.reverse();
}

export function nearestWaypoint(waypoints: WaypointNode[], x: number, z: number): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const node of waypoints) {
    const dist = Math.hypot(node.position[0] - x, node.position[1] - z);
    if (dist < bestDist || (dist === bestDist && (best === null || node.id < best))) {
      bestDist = dist;
      best = node.id;
    }
  }
  return best;
}

export function findPath(grid: Grid, start: Cell, goal: Cell): Cell[] {
  if (!grid[goal.row]?.[goal.col]) return [];
  const key = ({ col, row }: Cell) => `${col},${row}`;
  const queue: Cell[] = [start];
  const previous = new Map<string, Cell | null>([[key(start), null]]);
  const moves = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.col === goal.col && current.row === goal.row) break;
    for (const [dc, dr] of moves) {
      const next = { col: current.col + dc, row: current.row + dr };
      if (grid[next.row]?.[next.col] && !previous.has(key(next))) {
        previous.set(key(next), current);
        queue.push(next);
      }
    }
  }

  if (!previous.has(key(goal))) return [];
  const path: Cell[] = [];
  for (let at: Cell | null = goal; at && key(at) !== key(start); at = previous.get(key(at)) ?? null) {
    path.push(at);
  }
  return path.reverse();
}
