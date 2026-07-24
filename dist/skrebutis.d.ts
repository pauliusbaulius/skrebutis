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
export type ToastPosition = "top-right" | "top-left" | "top-center" | "bottom-right" | "bottom-left" | "bottom-center";
export type ToastAnimation = "grow" | "shrink" | "shake" | "slide" | "bounce" | "flip" | "pop" | "random";
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
export interface ToastApi {
    show(opts: ToastOptions): ToastResult | Promise<ToastResult>;
    success(message: string, opts?: ToastOptions): ToastResult | Promise<ToastResult>;
    error(message: string, opts?: ToastOptions): ToastResult | Promise<ToastResult>;
    warning(message: string, opts?: ToastOptions): ToastResult | Promise<ToastResult>;
    info(message: string, opts?: ToastOptions): ToastResult | Promise<ToastResult>;
    promise<T>(promise: Promise<T>, messages: PromiseMessages<T>, opts?: ToastOptions): Promise<T>;
    clear(): void;
}
declare const Toast: ToastApi;
export default Toast;
//# sourceMappingURL=skrebutis.d.ts.map