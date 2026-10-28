import { cn } from '@/lib/utils';
import { forwardRef, type LabelHTMLAttributes } from 'react';

/**
 * Label base de shadcn/ui.
 */
export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Label.displayName = 'Label';
