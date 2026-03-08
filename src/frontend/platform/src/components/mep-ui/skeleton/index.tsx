import { cname } from "../utils";

export default function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {

    return (
        <div
            className={cname("animate-pulse rounded-md bg-slate-200 dark:bg-slate-800", className)}
            {...props}
        />
    )
};
