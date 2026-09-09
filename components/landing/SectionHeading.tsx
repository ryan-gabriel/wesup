interface SectionHeadingProps {
    id?: string;
    eyebrow?: string;
    title: string;
    description?: string;
    align?: "center" | "left";
}

/**
 * Shared section heading for marketing/landing pages.
 */
export function SectionHeading({ id, eyebrow, title, description, align = "center" }: SectionHeadingProps) {
    const alignment = align === "center" ? "text-center mx-auto" : "text-left";
    return (
        <div id={id} className={`max-w-3xl ${alignment} mb-12 md:mb-16 scroll-mt-24`}>
            {eyebrow ? (
                <p className="mb-3 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                    {eyebrow}
                </p>
            ) : null}
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl text-balance">
                {title}
            </h2>
            {description ? (
                <p className="mt-4 text-lg text-slate-600 leading-relaxed text-pretty">
                    {description}
                </p>
            ) : null}
        </div>
    );
}