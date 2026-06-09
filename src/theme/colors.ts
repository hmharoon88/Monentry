export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceElevated: string;
  primary: string;
  primarySoft: string;
  expense: string;
  expenseSoft: string;
  income: string;
  incomeSoft: string;
  accent: string;
  accentSoft: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  shadow: string;
  tabBar: string;
  onPrimary: string;
}

export const lightColors: ThemeColors = {
  bg: '#F8F7F4',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  primary: '#2D6A4F',
  primarySoft: '#D8F3DC',
  expense: '#D1495B',
  expenseSoft: '#FDE8EB',
  income: '#2D6A4F',
  incomeSoft: '#D8F3DC',
  accent: '#F4A261',
  accentSoft: '#FEF3E8',
  textPrimary: '#1B1B1B',
  textSecondary: '#6B6B6B',
  textTertiary: '#9B9B9B',
  border: '#E8E6E1',
  shadow: 'rgba(0,0,0,0.06)',
  tabBar: '#FFFFFF',
  onPrimary: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  bg: '#121412',
  surface: '#1E211E',
  surfaceElevated: '#282B28',
  primary: '#52B788',
  primarySoft: '#1B3D2F',
  expense: '#E07A8A',
  expenseSoft: '#3D2228',
  income: '#52B788',
  incomeSoft: '#1B3D2F',
  accent: '#F4A261',
  accentSoft: '#3D3020',
  textPrimary: '#F0EFEB',
  textSecondary: '#A8A8A4',
  textTertiary: '#6B6B68',
  border: '#2E312E',
  shadow: 'rgba(0,0,0,0.3)',
  tabBar: '#1E211E',
  onPrimary: '#121412',
};
