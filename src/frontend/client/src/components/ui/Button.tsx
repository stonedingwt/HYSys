import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-sky-500 text-white hover:bg-sky-600 hover:shadow-sm',
        destructive:
          'bg-red-500 text-white hover:bg-red-600 hover:shadow-sm',
        outline:
          'text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-600 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800',
        secondary: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700',
        ghost: 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
        link: 'text-primary underline-offset-4 hover:underline',
        submit: 'bg-sky-500 text-white hover:bg-sky-600 shadow-sm',
        ai: 'bg-gradient-to-r from-sky-500 to-sky-400 text-white hover:from-sky-600 hover:to-sky-500 shadow-glow',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-lg px-6 text-base',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
