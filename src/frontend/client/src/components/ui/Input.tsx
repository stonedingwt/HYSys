import { SearchIcon } from "lucide-react";
import * as React from "react";

import { cn } from "~/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "flex h-10 w-full rounded-[12px] border border-slate-200 dark:border-white/[0.08] bg-transparent dark:bg-white/[0.04] px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/20 dark:focus-visible:ring-cyan-400/30 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 dark:disabled:bg-white/[0.02] disabled:text-gray-400 disabled:opacity-70",
          className ?? ""
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

const SearchInput = React.forwardRef<
  HTMLInputElement,
  InputProps & { inputClassName?: string; iconClassName?: string }
>(({ className, inputClassName, iconClassName, ...props }, ref) => {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon
        className={cn(
          "h-5 w-5 absolute left-2 top-2 text-slate-500 dark:text-slate-400 z-10",
          iconClassName
        )}
      />
      <Input
        type="text"
        ref={ref}
        className={cn("pl-8 bg-search-input", inputClassName)}
        {...props}
      ></Input>
    </div>
  );
});

SearchInput.displayName = "SearchInput";

export { Input, SearchInput };
