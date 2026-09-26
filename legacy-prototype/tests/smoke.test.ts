import { describe, expect, it } from 'vitest';
import { findPath, makeGrid } from '../src/render/navigation';

describe('walkable grid', () => {
  it('routes around a blocked cell without entering it', () => {
    const grid = makeGrid(3);
    grid[1][1] = false;
    const path = findPath(grid, { col: 0, row: 1 }, { col: 2, row: 1 });
    expect(path).toHaveLength(4);
    expect(path).not.toContainEqual({ col: 1, row: 1 });
  });
});
