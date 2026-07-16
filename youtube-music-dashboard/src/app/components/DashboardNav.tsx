import Link from "next/link";

const links = [
    { href: "/", label: "Dashboard" },
    { href: "/artists", label: "Artists" },
    { href: "/songs", label: "Songs" },
    { href: "/videos", label: "Videos" },
];

export function DashboardNav() {
    return (
        <nav className="mb-8 flex flex-wrap gap-3">
            {links.map((link) => (
                <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
                >
                    {link.label}
                </Link>
            ))}
        </nav>
    );
}
