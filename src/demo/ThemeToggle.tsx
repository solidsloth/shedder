// One button, cycling System → Dark → Light → System.

import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nextTheme, type Theme } from './theme.ts';

const ICON = { system: Monitor, dark: Moon, light: Sun } as const;
const NAME: Record<Theme, string> = { system: 'System', dark: 'Dark', light: 'Light' };

export function ThemeToggle({ theme, cycle }: { theme: Theme; cycle: () => void }) {
  const Icon = ICON[theme];
  const next = NAME[nextTheme(theme)];

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-7 shrink-0"
      onClick={cycle}
      // A single control that both reports and changes state has to say both,
      // or it reads as "Dark" when it is currently light.
      aria-label={`Theme: ${NAME[theme]}. Switch to ${next}.`}
      title={`Theme: ${NAME[theme]} — click for ${next}`}
    >
      <Icon className="size-3.5" />
      <span className="sr-only">{NAME[theme]}</span>
    </Button>
  );
}
