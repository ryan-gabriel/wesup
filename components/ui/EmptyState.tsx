import { ReactNode } from "react";

interface EmptyStateProps {
    /** SVG or image element to display above the heading */
    illustration?: ReactNode;
    heading: string;
    description?: string;
    /** Optional CTA button */
    action?: ReactNode;
}

export function EmptyState({
    illustration,
    heading,
    description,
    action,
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            {illustration ?? <DefaultIllustration />}

            <div className="space-y-1">
                <h3 className="text-base font-semibold text-gray-900">{heading}</h3>
                {description && (
                    <p className="max-w-sm text-sm text-gray-500">{description}</p>
                )}
            </div>

            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

function DefaultIllustration() {
    return (
        <svg
            className="h-24 w-24 text-gray-300"
            fill="none"
            viewBox="0 0 96 96"
            aria-hidden="true"
        >
            <circle cx="48" cy="48" r="40" className="fill-gray-100" />
            <path
                d="M32 48h32M48 32v32"
                className="stroke-gray-300"
                strokeWidth="4"
                strokeLinecap="round"
            />
            {/* Box outline */}
            <rect
                x="28"
                y="34"
                width="40"
                height="32"
                rx="4"
                stroke="#D1D5DB"
                strokeWidth="3"
                fill="none"
            />
            {/* Search circle */}
            <circle cx="62" cy="58" r="8" fill="white" stroke="#D1D5DB" strokeWidth="3" />
            <line
                x1="67"
                y1="63"
                x2="72"
                y2="68"
                stroke="#D1D5DB"
                strokeWidth="3"
                strokeLinecap="round"
            />
        </svg>
    );
}
