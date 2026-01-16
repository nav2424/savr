import React from 'react';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
  isActive?: boolean;
}

export const HomeIcon: React.FC<IconProps> = ({ size = 20, color = '#6A9571', isActive = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* House outline */}
    <Path
      d="M3 9L12 2L21 9V20C21 20.5523 20.5523 21 20 21H15V14C15 13.4477 14.5523 13 14 13H10C9.44772 13 9 13.4477 9 14V21H4C3.44772 21 3 20.5523 3 20V9Z"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={isActive ? 'rgba(106, 149, 113, 0.15)' : 'none'}
    />
  </Svg>
);

export const RecipesIcon: React.FC<IconProps> = ({ size = 20, color = '#6A9571', isActive = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Fork */}
    <Path
      d="M9 2V22"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
    />
    <Path
      d="M9 2C11 4 13 4 15 2"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M9 2C11 6 13 6 15 2"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Spoon */}
    <Path
      d="M15 2V22"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
    />
    <Path
      d="M13 22C15 22 17 20 17 18C17 16 15 14 13 14C11 14 9 16 9 18C9 20 11 22 13 22Z"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={color}
    />
  </Svg>
);

export const PantryIcon: React.FC<IconProps> = ({ size = 20, color = '#6A9571', isActive = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Shopping basket */}
    <Path
      d="M9 22C9.55228 22 10 21.5523 10 21C10 20.4477 9.55228 20 9 20C8.44772 20 8 20.4477 8 21C8 21.5523 8.44772 22 9 22Z"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M20 22C20.5523 22 21 21.5523 21 21C21 20.4477 20.5523 20 20 20C19.4477 20 19 20.4477 19 21C19 21.5523 19.4477 22 20 22Z"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M1 1H5L7.68 14.39C7.77144 14.8504 8.02191 15.264 8.38755 15.5583C8.75318 15.8526 9.2107 16.009 9.68 16H19.4C19.8693 16.009 20.3268 15.8526 20.6925 15.5583C21.0581 15.264 21.3086 14.8504 21.4 14.39L23 6H6"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ListsIcon: React.FC<IconProps> = ({ size = 20, color = '#6A9571', isActive = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Three horizontal lines with dots */}
    {/* First line (shorter) */}
    <Line
      x1="6"
      y1="8"
      x2="15"
      y2="8"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
    />
    <Circle
      cx="4"
      cy="8"
      r="1.5"
      fill={color}
    />
    
    {/* Second line (longer) */}
    <Line
      x1="6"
      y1="12"
      x2="18"
      y2="12"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
    />
    <Circle
      cx="4"
      cy="12"
      r="1.5"
      fill={color}
    />
    
    {/* Third line (shorter) */}
    <Line
      x1="6"
      y1="16"
      x2="13"
      y2="16"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
    />
    <Circle
      cx="4"
      cy="16"
      r="1.5"
      fill={color}
    />
  </Svg>
);

export const MealPlanIcon: React.FC<IconProps> = ({ size = 20, color = '#6A9571', isActive = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Calendar with checkmark */}
    <Rect
      x="3"
      y="4"
      width="18"
      height="18"
      rx="2"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Calendar header line */}
    <Path
      d="M3 9h18"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
    />
    {/* Top date indicators */}
    <Path
      d="M7 2v4M17 2v4"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
    />
    {/* Checkmark in calendar */}
    <Path
      d="M9 14l2 2 4-4"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
)

export const AllergiesIcon: React.FC<IconProps> = ({ size = 20, color = '#6A9571', isActive = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Warning shield with exclamation */}
    <Path
      d="M12 2L4 5V11C4 16.55 7.16 21.74 12 23C16.84 21.74 20 16.55 20 11V5L12 2Z"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={isActive ? 'rgba(106, 149, 113, 0.15)' : 'none'}
    />
    {/* Exclamation mark */}
    <Path
      d="M12 8V12M12 16H12.01"
      stroke={color}
      strokeWidth={isActive ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const MoreIcon: React.FC<IconProps> = ({ size = 20, color = '#6A9571', isActive = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {/* Three horizontal dots */}
    <Circle
      cx="6"
      cy="12"
      r="2"
      fill={color}
    />
    <Circle
      cx="12"
      cy="12"
      r="2"
      fill={color}
    />
    <Circle
      cx="18"
      cy="12"
      r="2"
      fill={color}
    />
  </Svg>
);
