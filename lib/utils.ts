/**
 * Merges Tailwind CSS class names, filtering falsy values.
 * Pure-TS implementation — no external dependencies.
 */
export function cn(...classes: (string | undefined | null | false | 0)[]): string {
    return classes.filter(Boolean).join(" ");
}
