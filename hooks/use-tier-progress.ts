"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readApiError } from "@/lib/marketplace/api-repository";
import { deriveTierProgress } from "@/lib/marketplace/tier-progress";
import type { MarketplaceProgressResponse } from "@/lib/marketplace/types";

const POLL_INTERVAL_MS = 4_000;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function canContinuePolling(progress: MarketplaceProgressResponse): boolean {
  if (progress.status.toLowerCase() !== "published") return false;
  const closesAt = Date.parse(progress.registrationClosesAt);
  return Number.isNaN(closesAt) || closesAt > Date.now();
}

export interface UseTierProgressResult {
  progress: MarketplaceProgressResponse;
  error: Error | null;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  applyRegistration: (registeredQuantity: number) => void;
}

export function useTierProgress(
  batchId: string,
  initialProgress: MarketplaceProgressResponse,
): UseTierProgressResult {
  const [progress, setProgress] = useState(initialProgress);
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const progressRef = useRef(initialProgress);
  const controllerRef = useRef<AbortController | null>(null);
  const pollingEnabledRef = useRef(canContinuePolling(initialProgress));
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (controllerRef.current) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    if (mountedRef.current) setIsRefreshing(true);

    try {
      const response = await fetch(
        `/api/batches/${encodeURIComponent(batchId)}/progress`,
        { signal: controller.signal, cache: "no-store" },
      );
      if (!response.ok) throw new Error(await readApiError(response));

      const next = (await response.json()) as MarketplaceProgressResponse;
      if (
        typeof next !== "object" ||
        next === null ||
        typeof next.registeredQuantity !== "number" ||
        !Array.isArray(next.tiers) ||
        typeof next.tierProgress !== "object"
      ) {
        throw new Error("Respons progress tidak valid");
      }

      progressRef.current = next;
      pollingEnabledRef.current = canContinuePolling(next);
      if (mountedRef.current) {
        setProgress(next);
        setError(null);
      }
    } catch (reason: unknown) {
      if (!isAbortError(reason) && mountedRef.current) {
        setError(reason instanceof Error ? reason : new Error("Gagal memuat progress tier."));
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      if (mountedRef.current) setIsRefreshing(false);
    }
  }, [batchId]);

  useEffect(() => {
    mountedRef.current = true;
    progressRef.current = initialProgress;
    pollingEnabledRef.current = canContinuePolling(initialProgress);
    // The first request is the hook's external synchronization with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();

    const interval = window.setInterval(() => {
      if (pollingEnabledRef.current && document.visibilityState !== "hidden") {
        void refresh();
      }
    }, POLL_INTERVAL_MS);

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && pollingEnabledRef.current) {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      mountedRef.current = false;
      pollingEnabledRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [batchId, initialProgress, refresh]);

  const applyRegistration = useCallback((registeredQuantity: number) => {
    const safeQuantity = Number.isFinite(registeredQuantity)
      ? Math.max(0, Math.trunc(registeredQuantity))
      : progressRef.current.registeredQuantity;
    const next = {
      ...progressRef.current,
      registeredQuantity: safeQuantity,
      tierProgress: deriveTierProgress(progressRef.current.tiers, safeQuantity),
    };
    progressRef.current = next;
    if (mountedRef.current) setProgress(next);
  }, []);

  return { progress, error, isRefreshing, refresh, applyRegistration };
}
