import { useSyncExternalStore } from "react";

const readPath = () => `${window.location.pathname}${window.location.search}` || "/";

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const normalizeTarget = (to: string) => {
  if (!to) return "/hub-dub";
  return to.startsWith("/hub-dub") ? to : `/hub-dub${to.startsWith("/") ? "" : "/"}${to}`;
};

const onPopState = () => notify();
window.addEventListener("popstate", onPopState);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const memoryNavigate = (to: string, opts?: any) => {
  const target = normalizeTarget(to);
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

export const memoryHook = (): [string, typeof memoryNavigate] => {
  const fullPath = useSyncExternalStore(subscribe, readPath, readPath);
  return [fullPath.split("?")[0] || "/", memoryNavigate];
};

export const memorySearchHook = (): string => {
  const fullPath = useSyncExternalStore(subscribe, readPath, readPath);
  const idx = fullPath.indexOf("?");
  return idx === -1 ? "" : fullPath.slice(idx + 1);
};
