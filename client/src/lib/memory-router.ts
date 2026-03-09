import { memoryLocation } from "wouter/memory-location";

const initialFull = window.location.pathname + window.location.search;

const { hook: _baseHook, navigate: _baseNavigate } = memoryLocation({ path: initialFull || "/" });

export const memoryNavigate = (to: string, opts?: any) => {
  _baseNavigate(to, opts);
};

export const memoryHook = (): [string, typeof memoryNavigate] => {
  const [fullPath] = _baseHook();
  const pathname = fullPath.split("?")[0] || "/";
  return [pathname, memoryNavigate];
};

export const memorySearchHook = (): string => {
  const [fullPath] = _baseHook();
  const idx = fullPath.indexOf("?");
  return idx === -1 ? "" : fullPath.slice(idx + 1);
};
