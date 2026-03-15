import type { LucideIcon as LucideIconType, LucideProps } from "lucide-react";
import {
  Briefcase, Laptop, Palette, GraduationCap, Leaf,
  Settings, Zap, Shield, Search, BookOpen,
  Bot, Terminal, Plug, BarChart3, MessageSquare,
} from "lucide-react";

const ICON_MAP = {
  Briefcase, Laptop, Palette, GraduationCap, Leaf,
  Settings, Zap, Shield, Search, BookOpen,
  Bot, Terminal, Plug, BarChart3, MessageSquare,
} satisfies Record<string, LucideIconType>;

export type IconName = keyof typeof ICON_MAP;

const DEFAULT_ICON: IconName = "BookOpen";

interface Props extends Omit<LucideProps, "ref"> {
  name: string;
}

export default function LucideIcon({ name, size = 24, "aria-label": ariaLabel, ...rest }: Props) {
  const Icon = ICON_MAP[name as IconName] ?? ICON_MAP[DEFAULT_ICON];
  return <Icon size={size} aria-hidden={!ariaLabel} aria-label={ariaLabel} {...rest} />;
}
