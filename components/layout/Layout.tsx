import { NavigationBar } from "@/components/layout/NavigationBar";
import { Footer } from "@/components/layout/Footer";
import { ReactNode } from "react";

interface LayoutProps {
    children: ReactNode;
}

/**
 * Main application layout — wraps every authenticated page with
 * the sticky NavigationBar at the top, a scrollable main content
 * area, and the Footer at the bottom.
 *
 * Usage (inside a route's page.tsx):
 *   import { Layout } from "@/components/layout/Layout";
 *   export default function Page() {
 *     return <Layout><YourContent /></Layout>;
 *   }
 */
export function Layout({ children }: LayoutProps) {
    return (
        <div className="flex min-h-screen flex-col">
            <NavigationBar />
            {/* pb-16 reserves space for the mobile bottom nav bar */}
            <main className="flex-1 pb-16 md:pb-0">{children}</main>
            <Footer />
        </div>
    );
}
