"use client";

import { useMemo } from "react";

const MODULES = 21;
const MODULE_SIZE = 10;
const VIEW_SIZE = MODULES * MODULE_SIZE;

/**
 * Pseudo-QR statis dan deterministik (basis UI PRD 2.2.4).
 * Pola modul diturunkan dari seed (kode pengambilan) sehingga tampil
 * konsisten antar perangkat tanpa menambah dependency QR library.
 * Role berikutnya mengganti blok ini dengan QR scannable asli.
 */
function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildMatrix(seed: string): boolean[][] {
  const matrix: boolean[][] = Array.from(
    { length: MODULES },
    () => Array<boolean>(MODULES).fill(false),
  );

  const setFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const border = x === 0 || x === 6 || y === 0 || y === 6;
        const center = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        matrix[oy + y][ox + x] = border || center;
      }
    }
  };

  setFinder(0, 0);
  setFinder(MODULES - 7, 0);
  setFinder(0, MODULES - 7);

  let state = hashSeed(seed);
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>>= 0);
  };

  const isFinderZone = (x: number, y: number) =>
    (x < 8 && y < 8) ||
    (x >= MODULES - 8 && y < 8) ||
    (x < 8 && y >= MODULES - 8);

  for (let y = 0; y < MODULES; y += 1) {
    for (let x = 0; x < MODULES; x += 1) {
      if (!isFinderZone(x, y)) matrix[y][x] = (next() & 1) === 1;
    }
  }

  return matrix;
}

function toPathD(matrix: boolean[][]): string {
  const parts: string[] = [];
  for (let y = 0; y < MODULES; y += 1) {
    for (let x = 0; x < MODULES; x += 1) {
      if (!matrix[y][x]) continue;
      const px = x * MODULE_SIZE;
      const py = y * MODULE_SIZE;
      parts.push(`M${px} ${py}h${MODULE_SIZE}v${MODULE_SIZE}h-${MODULE_SIZE}z`);
    }
  }
  return parts.join("");
}

export default function PickupQrBlock({
  seed,
}: {
  seed: string;
}) {
  const matrix = useMemo(() => buildMatrix(seed), [seed]);
  const pathD = useMemo(() => toPathD(matrix), [matrix]);

  return (
    <div
      className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      style={{ maxWidth: VIEW_SIZE + 48 }}
    >
      <svg
        role="img"
        aria-label="Ilustrasi kode QR pengambilan pesanan"
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        className="mx-auto block h-auto w-full"
      >
        <rect width={VIEW_SIZE} height={VIEW_SIZE} fill="#ffffff" />
        <path d={pathD} fill="#0f172a" />
      </svg>
    </div>
  );
}