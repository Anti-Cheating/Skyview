export interface LogoConfig {
  label: string;
  route: string;
  iconName: string;
}

export interface NavItem {
  id: string;
  label: string;
  iconName: string;
  route: string;
  badge?: string | number | null;
  /** Items sharing a group sit under one parent row that opens and closes. */
  group?: { id: string; label: string; iconName: string };
}

export interface SecondaryNavItem {
  id: string;
  label: string;
  iconName: string;
  route: string;
}

export interface ProfileConfig {
  id: string;
  label: string;
  avatarUrl?: string;
  route: string;
}

export interface SidebarProps {
  logo: LogoConfig;
  items: NavItem[];
  secondary?: SecondaryNavItem[];
  /** A small heading above `secondary`, e.g. "Workspace". */
  secondaryLabel?: string;
  profile: ProfileConfig;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (route: string) => void;
  activeId: string;
  width?: number;
  collapsedWidth?: number;
  density?: 'comfortable' | 'compact';
}
