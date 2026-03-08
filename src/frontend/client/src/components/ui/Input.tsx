import { SearchIcon } from "lucide-react";
import * as React from "react";

import { cn } from "~/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "flex h-10 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-800 disabled:text-gray-400 disabled:opacity-70",
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
          "h-5 w-5 absolute left-2 top-2 text-gray-500 dark:text-gray-400 z-10",
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
