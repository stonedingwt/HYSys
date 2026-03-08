import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-cyan-500 text-white hover:bg-cyan-600 hover:shadow-md',
        destructive:
          'bg-red-500 text-white hover:bg-red-600 hover:shadow-md',
        outline:
          'text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:-translate-y-px',
        secondary: 'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/[0.1]',
        ghost: 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]',
        link: 'text-cyan-600 dark:text-cyan-400 underline-offset-4 hover:underline',
        submit: 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-sm hover:shadow-md',
        ai: 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white hover:from-cyan-600 hover:to-violet-600 shadow-[0_0_20px_rgba(6,182,212,0.3)]',
        glass: 'bg-white/80 dark:bg-white/[0.06] backdrop-blur-xl text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-white/[0.08] hover:bg-white dark:hover:bg-white/[0.1] hover:-translate-y-px',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-[10px] px-3 text-xs',
        lg: 'h-11 rounded-[14px] px-6 text-base',
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
