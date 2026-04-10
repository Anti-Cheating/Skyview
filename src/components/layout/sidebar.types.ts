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

export interface UIConfig {
  collapsed: boolean;
  width: number;
  collapsedWidth: number;
}

export interface SidebarData {
  logo: LogoConfig;
  items: NavItem[];
  secondary: SecondaryNavItem[];
  profile: ProfileConfig;
  ui: UIConfig;
}

export interface SidebarProps {
  logo: LogoConfig;
  items: NavItem[];
  secondary: SecondaryNavItem[];
  profile: ProfileConfig;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate: (route: string) => void;
  activeId: string;
  width?: number;
  collapsedWidth?: number;
  colorMode?: 'light' | 'dark';
  density?: 'comfortable' | 'compact';
}
