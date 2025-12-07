import { describe, test, expect } from "bun:test";
import {
  normalizePagination,
  createPaginationMeta,
} from "../../utils/pagination";

describe("pagination", () => {
  test("clamps page to valid range", () => {
    expect(normalizePagination({ page: 0 }).page).toBe(1);
    expect(normalizePagination({ page: 99999 }).page).toBe(10000);
  });

  test("clamps limit to valid range", () => {
    expect(normalizePagination({ limit: 0 }).limit).toBe(1);
    expect(normalizePagination({ limit: 200 }).limit).toBe(100);
  });

  test("calculates offset correctly", () => {
    expect(normalizePagination({ page: 1, limit: 20 }).offset).toBe(0);
    expect(normalizePagination({ page: 3, limit: 20 }).offset).toBe(40);
  });

  test("caps offset at 100k", () => {
    expect(normalizePagination({ page: 10000, limit: 100 }).offset).toBe(
      100_000,
    );
  });

  test("creates correct pagination meta", () => {
    const meta = createPaginationMeta(2, 20, 100);
    expect(meta.totalPages).toBe(5);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(true);
  });
});
