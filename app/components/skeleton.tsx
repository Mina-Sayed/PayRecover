import { clsx } from 'clsx';

/**
 * Renders a pulsing, rounded div intended as a skeleton placeholder.
 *
 * @param className - Optional additional CSS classes to apply to the wrapper
 * @returns A div element styled as a pulsing skeleton placeholder
 */
export default function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-slate-200/80', className)} />;
}
