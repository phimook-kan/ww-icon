"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Icons", href: "/icons" },
    { name: "Icon Sets", href: "/icon-sets" },
  ];

  return (
    <nav className="border-b border-zinc-200 bg-white/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Logo / Brand */}
        <Link href="/" className="font-semibold text-sm tracking-tight text-zinc-900">
          Wolvesville<span className="text-zinc-400 ml-1">Manager</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-xs font-medium px-4 py-1.5 rounded-md transition-all ${
                  isActive
                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/60"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>

      </div>
    </nav>
  );
}