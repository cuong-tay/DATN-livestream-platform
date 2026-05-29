import { Check, Laptop, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui";
import { cn } from "@/shared/lib/utils";
import { useI18n, type LanguageCode } from "@/shared/i18n";

type ThemeMode = "light" | "dark" | "system";

const themeModes: Array<{ value: ThemeMode; icon: typeof Sun }> = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Laptop },
];

const labels: Record<LanguageCode, { label: string; modes: Record<ThemeMode, string> }> = {
  en: {
    label: "Theme",
    modes: { light: "Light", dark: "Dark", system: "System" },
  },
  vi: {
    label: "Giao dien",
    modes: { light: "Sang", dark: "Toi", system: "Theo he thong" },
  },
  es: {
    label: "Tema",
    modes: { light: "Claro", dark: "Oscuro", system: "Sistema" },
  },
};

function normalizeTheme(value: string | undefined): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function ThemeMenu({ className }: { className?: string }) {
  const { language } = useI18n();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);
  const copy = labels[language];

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activeTheme = normalizeTheme(theme);
  const triggerIcon = useMemo(() => {
    if (!isMounted || activeTheme === "system") return Laptop;
    return resolvedTheme === "dark" ? Moon : Sun;
  }, [activeTheme, isMounted, resolvedTheme]);
  const TriggerIcon = triggerIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring",
            className,
          )}
          title={copy.label}
          aria-label={copy.label}
        >
          <TriggerIcon className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 bg-popover text-popover-foreground">
        {themeModes.map((item) => {
          const Icon = item.icon;
          const isActive = item.value === activeTheme;

          return (
            <DropdownMenuItem
              key={item.value}
              onClick={() => setTheme(item.value)}
              className="flex cursor-pointer items-center gap-2"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1">{copy.modes[item.value]}</span>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
