import { cname } from "../utils";

export default function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {

    return (
        <div
            className={cname("animate-pulse rounded-md bg-navy-200 dark:bg-navy-800", className)}
            {...props}
        />
    )
};
