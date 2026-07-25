"use client";
import { usePathname } from "next/navigation";

export default function Navbar() {
    const pathname = usePathname();
    const tabs = [
        {
            text: "Top Listens",
            link: "/top-listens",
        },
        {
            text: "Artists",
            link: "/artists",
        },
        {
            text: "Videos",
            link: "/videos",
        },
    ];

    return (
        <div>
            <ul className="px-0 ml-0 list-none flex gap-2">
                {tabs.map((tab) => (
                    <li key={tab.text}>
                        <a
                            href={tab.link}
                            className={`p-3 bg-stone-600 ${pathname === tab.link ? "text-orange-400" : "text-orange-50"}`}
                        >
                            {tab.text}
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
}
