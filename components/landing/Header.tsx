"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { User, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const APP_VERSION = "1.0.0";

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-xl border-b border-white/10 pointer-events-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/VolinaLogo.png"
                alt="Volina AI Logo"
                width={32}
                height={32}
                className="h-8 w-auto"
                priority
              />
              <span className="font-semibold text-white text-lg tracking-tight">
                Volina<span className="text-blue-400">AI</span>
              </span>
            </Link>
            <span className="text-xs text-white/40 bg-white/10 px-2 py-0.5 rounded">
              v{APP_VERSION}
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection("features")}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection("team")}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Team
            </button>
            <button
              onClick={() => scrollToSection("demo")}
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Demo
            </button>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Login Button - Links to /login page */}
            <Link href="/login">
              <Button variant="ghost" size="icon" className="rounded-full text-white/70 hover:text-white hover:bg-white/10">
                <User className="h-5 w-5" />
              </Button>
            </Link>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/10">
            <nav className="flex flex-col gap-2">
              <button
                onClick={() => scrollToSection("features")}
                className="text-left px-4 py-2 text-white/70 hover:bg-white/10 rounded-lg"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("team")}
                className="text-left px-4 py-2 text-white/70 hover:bg-white/10 rounded-lg"
              >
                Team
              </button>
              <button
                onClick={() => scrollToSection("demo")}
                className="text-left px-4 py-2 text-white/70 hover:bg-white/10 rounded-lg"
              >
                Demo
              </button>
              <Link
                href="/login"
                className="text-left px-4 py-2 text-white/70 hover:bg-white/10 rounded-lg"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign In
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
