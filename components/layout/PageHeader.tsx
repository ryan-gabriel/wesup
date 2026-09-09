import type { ReactNode } from "react";

interface PageHeaderProps {
    title: string;
    description?: string;
    icon?: ReactNode;
}

/**
 * Shared page header used across UMKM-facing pages for a consistent
 * title/description/icon treatment (see app/akun, app/pesanan, etc.).
 */
export function PageHeader({ title, description, icon }: PageHeaderProps) {
    return (
        <header className="mb-6">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl text-balance">
                {icon ? (
                    <span className="text-blue-600" aria-hidden="true">
                        {icon}
                    </span>
                ) : null}
                {title}
            </h1>
            {description ? (
                <p className="mt-1 text-base text-slate-600 text-pretty">{description}</p>
            ) : null}
        </header>
    );
}