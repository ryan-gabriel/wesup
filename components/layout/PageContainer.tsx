import type { ReactNode } from "react";

interface PageContainerProps {
    children: ReactNode;
}

/**
 * Shared content wrapper — standardizes the max-width and padding of every
 * UMKM-facing page so layouts stay consistent across routes.
 */
export function PageContainer({ children }: PageContainerProps) {
    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
        </div>
    );
}