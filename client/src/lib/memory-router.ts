import { useSyncExternalStore } from "react";

const readPath = () => `${window.location.pathname}${window.location.search}` || "/";
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

window.addEventListener("popstate", notify);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const memoryNavigate = (to: string, opts?: any) => {
  const target = to || "/";
  const replace = Boolean(opts?.replace);
  const current = readPath();
  if (current !== target) {
    if (replace) {
      window.history.replaceState({}, "", target);
    } else {
      window.history.pushState({}, "", target);
    }
  }
  notify();
};

export const canGoBack = () => window.history.length > 1;

export const goBack = (fallback = "/") => {
  if (canGoBack()) {
    window.history.back();
    return;
  }
  memoryNavigate(fallback, { replace: true });
};

export const memoryHook = (): [string, typeof memoryNavigate] => {
  const fullPath = useSyncExternalStore(subscribe, readPath, readPath);
  return [fullPath.split("?")[0] || "/", memoryNavigate];
};

export const memorySearchHook = (): string => {
  const fullPath = useSyncExternalStore(subscribe, readPath, readPath);
  const idx = fullPath.indexOf("?");
  return idx === -1 ? "" : fullPath.slice(idx + 1);
};
