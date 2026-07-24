/**
 * Skrebutis — drop-in toast notifications.
 *
 *   import Toast from './skrebutis.js'
 *   Toast.success('Saved!')
 *   Toast.error('Oops', { position: 'bottom-center' })
 *   Toast.promise(fetch('/api'), { loading: 'Saving...', success: 'Done!', error: 'Failed' })
 *
 * Default options (DEFAULTS): type, duration, position, dismissible, pauseOnHover,
 * animation: 'random', maxToasts, icon, showProgress, confetti, size: 'random' (normal vs large per toast).
 *
 * Mounting: when the Popover API exists, toast stacks live in a `popover=manual` host
 * (CSS top layer) so they sit above normal z-index stacking; otherwise falls back to
 * `document.body`. Native modal `<dialog open>` still wins per browser top-layer rules;
 * pairing with in-dialog feedback or a custom mount target is a separate integration.
 */

export type ToastType = "success" | "error" | "warning" | "info";
export type ToastPosition =
  | "top-right"
  | "top-left"
  | "top-center"
  | "bottom-right"
  | "bottom-left"
  | "bottom-center";
export type ToastAnimation =
  | "grow"
  | "shrink"
  | "shake"
  | "slide"
  | "bounce"
  | "flip"
  | "pop"
  | "random";
export type ToastSize = "normal" | "large" | "random";

export interface ToastOptions {
  type?: ToastType;
  message?: string;
  duration?: number;
  position?: ToastPosition;
  dismissible?: boolean;
  pauseOnHover?: boolean;
  animation?: ToastAnimation;
  maxToasts?: number;
  icon?: string | null;
  showProgress?: boolean;
  confetti?: boolean;
  size?: ToastSize;
  onClose?: () => void;
}

export interface ToastResult {
  id: number;
  element: HTMLDivElement;
  dismiss: () => void;
}

export interface PromiseMessages<T = unknown> {
  loading: string;
  success: string | ((result: T) => string);
  error: string | ((err: unknown) => string);
}

interface ResolvedToastOptions extends ToastOptions {
  type: ToastType;
  message: string;
  duration: number;
  position: ToastPosition;
  dismissible: boolean;
  pauseOnHover: boolean;
  animation: ToastAnimation;
  maxToasts: number;
  icon: string | null;
  showProgress: boolean;
  confetti: boolean;
  /** Resolved to normal|large in showToast when value is random. */
  size: ToastSize;
}

interface ToastElement extends HTMLDivElement {
  _skrebutis_state?: {
    timeoutId: ReturnType<typeof setTimeout> | null;
    startTime: number;
    remaining: number;
    paused: boolean;
  };
  _skrebutis_pause?: () => void;
  _skrebutis_resume?: () => void;
}

const STYLES = `
@layer skrebutis {
  /* Top-layer host: popover API escapes stacking contexts; manual = no light-dismiss. */
  .skrebutis-popover-host[popover] {
    position: fixed;
    inset: 0;
    width: auto;
    min-width: 100%;
    min-height: 100%;
    max-width: none;
    max-height: none;
    margin: 0;
    border: none;
    padding: 0;
    background: transparent;
    box-shadow: none;
    overflow: visible;
    pointer-events: none;
  }
  .skrebutis-popover-host[popover]::backdrop {
    display: none;
  }

  .skrebutis-container {
    position: fixed; z-index: 99999; display: flex; flex-direction: column;
    gap: 12px; pointer-events: none; max-height: 100vh; overflow: visible;
  }
  .skrebutis-container[data-position="top-right"]    { top: 20px; right: 20px; align-items: flex-end; }
  .skrebutis-container[data-position="top-left"]     { top: 20px; left: 20px;  align-items: flex-start; }
  .skrebutis-container[data-position="top-center"]   { top: 20px; left: 50%;   transform: translateX(-50%); align-items: center; }
  .skrebutis-container[data-position="bottom-right"] { bottom: 20px; right: 20px; align-items: flex-end; }
  .skrebutis-container[data-position="bottom-left"]  { bottom: 20px; left: 20px;  align-items: flex-start; }
  .skrebutis-container[data-position="bottom-center"]{ bottom: 20px; left: 50%;   transform: translateX(-50%); align-items: center; }

  .skrebutis-queue-badge {
    order: 99999; pointer-events: auto; padding: 6px 14px; border-radius: 999px;
    font-family: system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 700;
    color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.25);
    backdrop-filter: blur(8px); text-align: center;
  }

  .skrebutis-toast {
    pointer-events: auto; position: relative; display: flex; align-items: center;
    gap: 12px; min-width: 260px; max-width: 400px; padding: 16px 22px;
    border-radius: 16px; font-family: system-ui, -apple-system, sans-serif;
    font-size: 15px; font-weight: 600; line-height: 1.4; color: #fff;
    background: linear-gradient(135deg, #667eea, #764ba2); border: none;
    box-shadow: 0 8px 24px rgba(118,75,162,0.3), 0 2px 8px rgba(0,0,0,0.1);
    overflow: hidden; backdrop-filter: blur(8px);
  }

  .skrebutis-toast[data-type="success"] {
    background: linear-gradient(135deg, #43e97b, #38f9d7); color: #064e2b;
    box-shadow: 0 8px 24px rgba(67,233,123,0.3), 0 2px 8px rgba(0,0,0,0.08);
  }
  .skrebutis-toast[data-type="error"] {
    background: linear-gradient(135deg, #f857a6, #ff5858); color: #fff;
    box-shadow: 0 8px 24px rgba(255,88,88,0.35), 0 2px 8px rgba(0,0,0,0.08);
  }
  .skrebutis-toast[data-type="warning"] {
    background: linear-gradient(135deg, #f7971e, #ffd200); color: #5c3a00;
    box-shadow: 0 8px 24px rgba(247,151,30,0.3), 0 2px 8px rgba(0,0,0,0.08);
  }
  .skrebutis-toast[data-type="info"] {
    background: linear-gradient(135deg, #4facfe, #00f2fe); color: #003049;
    box-shadow: 0 8px 24px rgba(79,172,254,0.3), 0 2px 8px rgba(0,0,0,0.08);
  }

  .skrebutis-toast[data-size="large"] {
    min-width: 340px; max-width: 520px; padding: 22px 28px; gap: 16px;
    border-radius: 20px; font-size: 18px;
    box-shadow: 0 12px 36px rgba(118,75,162,0.35), 0 4px 12px rgba(0,0,0,0.12);
  }
  .skrebutis-toast[data-size="large"] .skrebutis-icon { font-size: 32px; }
  .skrebutis-toast[data-size="large"] .skrebutis-progress-track { height: 5px; border-radius: 0 0 20px 20px; }

  .skrebutis-icon {
    flex-shrink: 0; font-size: 22px; line-height: 1;
    display: flex; align-items: center; justify-content: center;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.15));
  }
  .skrebutis-msg { flex: 1; word-break: break-word; text-shadow: 0 1px 2px rgba(0,0,0,0.08); }

  .skrebutis-progress-track {
    position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
    background: rgba(255,255,255,0.2); border-radius: 0 0 16px 16px; overflow: hidden;
  }
  .skrebutis-progress { height: 100%; width: 100%; border-radius: inherit; background: rgba(255,255,255,0.6); }
  .skrebutis-toast[data-type="success"] .skrebutis-progress { background: rgba(6,78,43,0.35); }
  .skrebutis-toast[data-type="warning"] .skrebutis-progress { background: rgba(92,58,0,0.3); }
  .skrebutis-toast[data-type="info"]    .skrebutis-progress { background: rgba(0,48,73,0.3); }

  @keyframes skrebutis-grow-in {
    0%   { opacity: 0; transform: scale(0.15); }
    65%  { transform: scale(1.08); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes skrebutis-grow-out {
    0%   { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.3); }
  }
  .skrebutis-grow-enter { animation: skrebutis-grow-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
  .skrebutis-grow-exit  { animation: skrebutis-grow-out 0.25s ease-in both; }

  @keyframes skrebutis-shrink-in {
    0%   { opacity: 0; transform: scale(2.2); }
    70%  { transform: scale(0.95); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes skrebutis-shrink-out {
    0%   { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1.8); }
  }
  .skrebutis-shrink-enter { animation: skrebutis-shrink-in 0.35s cubic-bezier(0.25,0.46,0.45,0.94) both; }
  .skrebutis-shrink-exit  { animation: skrebutis-shrink-out 0.25s ease-in both; }

  @keyframes skrebutis-shake-in {
    0%   { opacity: 0; transform: scale(0.5); }
    40%  { opacity: 1; transform: scale(1); }
    50%  { transform: translateX(-10px) rotate(-1deg); }
    60%  { transform: translateX(8px) rotate(1deg); }
    70%  { transform: translateX(-5px); }
    80%  { transform: translateX(3px); }
    90%  { transform: translateX(-1px); }
    100% { transform: translateX(0); }
  }
  @keyframes skrebutis-shake-out {
    0%   { transform: translateX(0); }
    20%  { transform: translateX(-8px) rotate(-2deg); }
    40%  { transform: translateX(8px) rotate(2deg); opacity: 1; }
    100% { transform: translateX(50px) rotate(4deg); opacity: 0; }
  }
  .skrebutis-shake-enter { animation: skrebutis-shake-in 0.6s cubic-bezier(0.22,1,0.36,1) both; }
  .skrebutis-shake-exit  { animation: skrebutis-shake-out 0.35s ease-in both; }

  @keyframes skrebutis-slide-in {
    0%   { opacity: 0; transform: translateX(120%) rotate(3deg); }
    100% { opacity: 1; transform: translateX(0) rotate(0deg); }
  }
  @keyframes skrebutis-slide-out {
    0%   { opacity: 1; transform: translateX(0) rotate(0deg); }
    100% { opacity: 0; transform: translateX(120%) rotate(3deg); }
  }
  .skrebutis-slide-enter { animation: skrebutis-slide-in 0.45s cubic-bezier(0.22,1,0.36,1) both; }
  .skrebutis-slide-exit  { animation: skrebutis-slide-out 0.3s ease-in both; }

  @keyframes skrebutis-bounce-in {
    0%   { opacity: 0; transform: translateY(-80px) scale(0.8) rotate(-3deg); }
    45%  { opacity: 1; transform: translateY(12px) scale(1.04) rotate(1deg); }
    65%  { transform: translateY(-6px) scale(1) rotate(0deg); }
    80%  { transform: translateY(3px); }
    100% { transform: translateY(0) scale(1) rotate(0deg); }
  }
  @keyframes skrebutis-bounce-out {
    0%   { opacity: 1; transform: translateY(0); }
    25%  { transform: translateY(10px) scale(1.02); opacity: 1; }
    100% { opacity: 0; transform: translateY(-60px) scale(0.9) rotate(3deg); }
  }
  .skrebutis-bounce-enter { animation: skrebutis-bounce-in 0.6s cubic-bezier(0.22,1,0.36,1) both; }
  .skrebutis-bounce-exit  { animation: skrebutis-bounce-out 0.35s ease-in both; }

  @keyframes skrebutis-flip-in {
    0%   { opacity: 0; transform: perspective(600px) rotateX(-90deg) scale(0.9); }
    50%  { transform: perspective(600px) rotateX(12deg) scale(1.02); }
    70%  { transform: perspective(600px) rotateX(-5deg); }
    100% { opacity: 1; transform: perspective(600px) rotateX(0deg) scale(1); }
  }
  @keyframes skrebutis-flip-out {
    0%   { opacity: 1; transform: perspective(600px) rotateX(0deg); }
    100% { opacity: 0; transform: perspective(600px) rotateX(80deg) scale(0.9); }
  }
  .skrebutis-flip-enter { animation: skrebutis-flip-in 0.55s cubic-bezier(0.22,1,0.36,1) both; }
  .skrebutis-flip-exit  { animation: skrebutis-flip-out 0.3s ease-in both; }

  @keyframes skrebutis-pop-in {
    0%   { opacity: 0; transform: scale(0) rotate(-15deg); }
    55%  { transform: scale(1.12) rotate(3deg); }
    75%  { transform: scale(0.96) rotate(-1deg); }
    100% { opacity: 1; transform: scale(1) rotate(0deg); }
  }
  @keyframes skrebutis-pop-out {
    0%   { opacity: 1; transform: scale(1) rotate(0deg); }
    100% { opacity: 0; transform: scale(0.4) rotate(12deg); }
  }
  .skrebutis-pop-enter { animation: skrebutis-pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both; }
  .skrebutis-pop-exit  { animation: skrebutis-pop-out 0.25s ease-in both; }

  @media (prefers-reduced-motion: reduce) {
    .skrebutis-toast { animation: none !important; }
  }
}`;

function injectStyles(): void {
  if (typeof document === "undefined" || document.getElementById("skrebutis-styles")) return;
  const s = document.createElement("style");
  s.id = "skrebutis-styles";
  s.textContent = STYLES;
  document.head.appendChild(s);
}

const ANIMATIONS: Record<string, string> = {
  grow: "skrebutis-grow",
  shrink: "skrebutis-shrink",
  shake: "skrebutis-shake",
  slide: "skrebutis-slide",
  bounce: "skrebutis-bounce",
  flip: "skrebutis-flip",
  pop: "skrebutis-pop",
};

const DEFAULTS: ResolvedToastOptions = {
  type: "success",
  duration: 4000,
  position: "top-right",
  dismissible: true,
  pauseOnHover: true,
  animation: "random",
  maxToasts: 10,
  icon: null,
  showProgress: true,
  confetti: false,
  size: "random",
  message: "",
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: "✅",
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
};

const CONFETTI_EMOJIS: Record<"success" | "error", string[]> = {
  success: ["🎉", "🎊", "🥳", "✨", "🌟", "💫", "⭐", "🎆", "🍾", "🏆"],
  error: ["💀", "😱", "😭", "🔥", "💥", "☠️", "🫠", "😵", "🆘", "👻"],
};

function pick<T>(val: T, list: T[]): T {
  return val === "random" ? (list[Math.floor(Math.random() * list.length)] as T) : val;
}

const containers = new Map<string, HTMLDivElement>();
const queues = new Map<string, Array<{ opts: ResolvedToastOptions; resolve: (r: ToastResult | Promise<ToastResult>) => void }>>();
let idCounter = 0;

/** When set, toast stacks are mounted here (Popover top layer). */
let popoverHost: HTMLDivElement | null = null;
/** After a failed showPopover, or without API support, use body for the session. */
let popoverLayerDisabled = false;

function supportsPopover(): boolean {
  if (typeof HTMLElement === "undefined") return false;
  return typeof (HTMLElement.prototype as unknown as { showPopover?: () => void }).showPopover === "function";
}

function showPopoverSafe(el: HTMLElement): boolean {
  const fn = (el as HTMLElement & { showPopover?: () => void }).showPopover;
  if (typeof fn !== "function") return false;
  try {
    fn.call(el);
    return true;
  } catch {
    return false;
  }
}

function hidePopoverSafe(el: HTMLElement): void {
  const fn = (el as HTMLElement & { hidePopover?: () => void }).hidePopover;
  if (typeof fn !== "function") return;
  try {
    fn.call(el);
  } catch {
    /* ignore */
  }
}

/**
 * Returns the mount parent for `.skrebutis-container` nodes: a `popover=manual` host
 * (top layer) when supported, otherwise `document.body`.
 */
function getToastLayer(): HTMLElement {
  injectStyles();
  if (popoverLayerDisabled || !supportsPopover()) {
    return document.body;
  }
  if (!popoverHost) {
    const host = document.createElement("div");
    host.id = "skrebutis-popover-host";
    host.className = "skrebutis-popover-host";
    host.setAttribute("popover", "manual");
    document.body.appendChild(host);
    popoverHost = host;
    if (!showPopoverSafe(host)) {
      popoverLayerDisabled = true;
      host.remove();
      popoverHost = null;
      return document.body;
    }
    return host;
  }
  showPopoverSafe(popoverHost);
  return popoverHost;
}

/** Hide popover host when no toast containers remain (keeps top layer clean). */
function syncPopoverHostAfterContainersChange(): void {
  if (popoverLayerDisabled || !popoverHost?.isConnected) return;
  if (popoverHost.querySelector(".skrebutis-container")) return;
  hidePopoverSafe(popoverHost);
}

function getContainer(position: string): HTMLDivElement {
  const existing = containers.get(position);
  if (existing) return existing;
  const el = document.createElement("div");
  el.className = "skrebutis-container";
  el.dataset.position = position;
  el.setAttribute("aria-live", "polite");
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "Notifications");
  getToastLayer().appendChild(el);
  containers.set(position, el);
  return el;
}

function cleanContainer(container: HTMLDivElement | null): void {
  if (container && container.childNodes.length === 0) {
    container.remove();
    for (const [pos, el] of containers) {
      if (el === container) {
        containers.delete(pos);
        break;
      }
    }
    syncPopoverHostAfterContainersChange();
  }
}

function showToast(o: ResolvedToastOptions, container: HTMLDivElement): ToastResult {
  o.animation = pick(o.animation, Object.keys(ANIMATIONS)) as ToastAnimation;
  o.size = pick(o.size, ["normal", "large"]) as "normal" | "large";
  updateQueueBadge(o.position);

  const id = ++idCounter;
  const toast = document.createElement("div") as ToastElement;
  toast.className = "skrebutis-toast";
  toast.dataset.type = o.type;
  toast.dataset.animation = o.animation;
  if (o.size !== "normal") toast.dataset.size = o.size;
  toast.dataset.id = String(id);
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-atomic", "true");

  const iconText = (o.icon ?? TYPE_ICONS[o.type] ?? "") as string;
  if (iconText) {
    const iconEl = document.createElement("span");
    iconEl.className = "skrebutis-icon";
    iconEl.setAttribute("aria-hidden", "true");
    iconEl.textContent = iconText;
    toast.appendChild(iconEl);
  }

  const msg = document.createElement("span");
  msg.className = "skrebutis-msg";
  msg.textContent = o.message;
  toast.appendChild(msg);

  if (o.dismissible) {
    toast.style.cursor = "pointer";
    toast.onclick = () => remove(toast, o.onClose);
  }

  let progressBar: HTMLDivElement | null = null;
  if (o.showProgress && o.duration > 0) {
    const track = document.createElement("div");
    track.className = "skrebutis-progress-track";
    progressBar = document.createElement("div");
    progressBar.className = "skrebutis-progress";
    progressBar.dataset.type = o.type;
    track.appendChild(progressBar);
    toast.appendChild(track);
  }

  const enterClass = (ANIMATIONS[o.animation] ?? "skrebutis-grow") + "-enter";
  toast.classList.add(enterClass);
  container.appendChild(toast);

  if (o.confetti && (o.type === "success" || o.type === "error")) {
    requestAnimationFrame(() => spawnConfetti(toast, o.type as "success" | "error"));
  }

  if (o.duration > 0) setupAutoDismiss(toast, progressBar, o);

  return { id, element: toast, dismiss: () => remove(toast, o.onClose) };
}

function enqueueOrShow(opts: ToastOptions): ToastResult | Promise<ToastResult> {
  injectStyles();
  const o: ResolvedToastOptions = { ...DEFAULTS, ...opts, message: opts.message ?? "" } as ResolvedToastOptions;
  const container = getContainer(o.position);
  const visible = container.querySelectorAll(".skrebutis-toast:not([data-removing])").length;

  if (visible >= o.maxToasts) {
    const q = queues.get(o.position) ?? [];
    if (!queues.has(o.position)) queues.set(o.position, q);
    const p = new Promise<ToastResult>((resolve) => {
      q.push({ opts: o, resolve });
    });
    updateQueueBadge(o.position);
    return p;
  }

  return showToast(o, container);
}

function drainQueue(position: string): void {
  const q = queues.get(position);
  if (!q || q.length === 0) {
    updateQueueBadge(position);
    return;
  }

  const container = containers.get(position);
  if (!container) return;

  const visible = container.querySelectorAll(".skrebutis-toast:not([data-removing])").length;
  if (visible < q[0].opts.maxToasts) {
    const { opts, resolve } = q.shift()!;
    resolve(showToast(opts, container));
  }
  updateQueueBadge(position);
}

function updateQueueBadge(position: string): void {
  const container = containers.get(position);
  if (!container) return;
  const q = queues.get(position);
  const count = q ? q.length : 0;
  let badge = container.querySelector(".skrebutis-queue-badge");
  if (count === 0) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "skrebutis-queue-badge";
    container.appendChild(badge);
  }
  badge.textContent = `+${count} pending`;
}

function setupAutoDismiss(
  toast: ToastElement,
  progressBar: HTMLDivElement | null,
  opts: ResolvedToastOptions
): void {
  const state = {
    timeoutId: null as ReturnType<typeof setTimeout> | null,
    startTime: Date.now(),
    remaining: opts.duration,
    paused: false,
  };

  if (progressBar) {
    progressBar.style.transition = `width ${opts.duration}ms linear`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        progressBar.style.width = "0%";
      });
    });
  }

  const start = (): void => {
    state.startTime = Date.now();
    state.timeoutId = setTimeout(() => remove(toast, opts.onClose), state.remaining);
  };

  const pause = (): void => {
    if (state.paused || state.timeoutId === null) return;
    state.paused = true;
    state.remaining = Math.max(0, state.remaining - (Date.now() - state.startTime));
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
    if (progressBar) {
      const cur = getComputedStyle(progressBar).width;
      progressBar.style.transition = "none";
      progressBar.style.width = cur;
      void progressBar.offsetWidth;
    }
  };

  const resume = (): void => {
    if (!state.paused || state.remaining <= 0) return;
    state.paused = false;
    if (progressBar) {
      requestAnimationFrame(() => {
        progressBar.style.transition = `width ${state.remaining}ms linear`;
        progressBar.style.width = "0%";
      });
    }
    start();
  };

  if (opts.pauseOnHover) {
    toast.addEventListener("mouseenter", pause);
    toast.addEventListener("mouseleave", resume);
    toast._skrebutis_pause = pause;
    toast._skrebutis_resume = resume;
  }

  start();
  toast._skrebutis_state = state;
}

function remove(toast: ToastElement, onClose?: () => void): void {
  if (toast.dataset.removing) return;
  toast.dataset.removing = "true";

  const state = toast._skrebutis_state;
  if (state?.timeoutId) {
    clearTimeout(state.timeoutId);
    state.timeoutId = null;
  }
  if (toast._skrebutis_pause) toast.removeEventListener("mouseenter", toast._skrebutis_pause);
  if (toast._skrebutis_resume) toast.removeEventListener("mouseleave", toast._skrebutis_resume);

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const position = (toast.closest(".skrebutis-container") as HTMLElement | null)?.dataset.position;

  const cleanup = (): void => {
    const parent = toast.parentElement;
    if (toast.isConnected) toast.remove();
    cleanContainer(parent as HTMLDivElement | null);
    if (typeof onClose === "function") onClose();
    if (position) drainQueue(position);
  };

  if (prefersReduced) {
    cleanup();
    return;
  }

  const exitClass = (ANIMATIONS[toast.dataset.animation ?? ""] ?? "skrebutis-grow") + "-exit";
  for (const cls of Array.from(toast.classList)) {
    if (cls.endsWith("-enter")) toast.classList.remove(cls);
  }
  toast.classList.add(exitClass);

  const fallback = setTimeout(cleanup, 500);
  toast.addEventListener(
    "animationend",
    (e: AnimationEvent) => {
      if (e.target !== toast) return;
      clearTimeout(fallback);
      cleanup();
    },
    { once: true }
  );
}

function spawnConfetti(toast: HTMLDivElement, type: "success" | "error"): void {
  const emojis = CONFETTI_EMOJIS[type];
  if (!emojis) return;
  const rect = toast.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const count = 18 + Math.floor(Math.random() * 8);

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;font-size:${16 + Math.random() * 18}px;pointer-events:none;z-index:100000;will-change:transform,opacity;`;
    document.body.appendChild(el);

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
    const v = 120 + Math.random() * 200;
    const vx = Math.cos(angle) * v;
    const vy = Math.sin(angle) * v - 80 - Math.random() * 100;
    const spin = (Math.random() - 0.5) * 720;
    const dur = 800 + Math.random() * 600;

    el.animate(
      [
        { transform: "translate(0,0) rotate(0deg) scale(0.3)", opacity: 1 },
        { transform: "translate(0,0) rotate(0deg) scale(1.2)", opacity: 1, offset: 0.1 },
        {
          transform: `translate(${vx}px,${vy + 200}px) rotate(${spin}deg) scale(0.4)`,
          opacity: 0,
        },
      ],
      { duration: dur, easing: "cubic-bezier(0.25,0.46,0.45,0.94)", fill: "forwards" }
    ).onfinish = () => el.remove();
  }
}

export interface ToastApi {
  show(opts: ToastOptions): ToastResult | Promise<ToastResult>;
  success(message: string, opts?: ToastOptions): ToastResult | Promise<ToastResult>;
  error(message: string, opts?: ToastOptions): ToastResult | Promise<ToastResult>;
  warning(message: string, opts?: ToastOptions): ToastResult | Promise<ToastResult>;
  info(message: string, opts?: ToastOptions): ToastResult | Promise<ToastResult>;
  promise<T>(promise: Promise<T>, messages: PromiseMessages<T>, opts?: ToastOptions): Promise<T>;
  clear(): void;
}

const Toast: ToastApi = {
  show(opts) {
    return enqueueOrShow(opts);
  },
  success(message, opts) {
    return enqueueOrShow({ ...opts, message, type: "success" });
  },
  error(message, opts) {
    return enqueueOrShow({ ...opts, message, type: "error" });
  },
  warning(message, opts) {
    return enqueueOrShow({ ...opts, message, type: "warning" });
  },
  info(message, opts) {
    return enqueueOrShow({ ...opts, message, type: "info" });
  },

  async promise<T>(promise: Promise<T>, messages: PromiseMessages<T>, opts?: ToastOptions): Promise<T> {
    const t = await enqueueOrShow({
      ...opts,
      message: messages.loading,
      type: "info",
      duration: 0,
      dismissible: false,
      showProgress: false,
    });
    try {
      const result = await promise;
      remove(t.element as ToastElement);
      Toast.success(
        typeof messages.success === "function" ? messages.success(result) : messages.success,
        opts
      );
      return result;
    } catch (err) {
      remove(t.element as ToastElement);
      Toast.error(
        typeof messages.error === "function" ? messages.error(err) : messages.error,
        opts
      );
      throw err;
    }
  },

  clear() {
    queues.clear();
    document.querySelectorAll(".skrebutis-queue-badge").forEach((b) => b.remove());
    document.querySelectorAll(".skrebutis-toast").forEach((t) => remove(t as ToastElement));
    syncPopoverHostAfterContainersChange();
  },
};

if (typeof window !== "undefined") (window as unknown as { Toast: ToastApi }).Toast = Toast;

export default Toast;
