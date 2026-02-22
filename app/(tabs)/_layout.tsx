import React from "react"
import { Tabs } from "expo-router"
import { Text, View, StyleSheet, Animated } from "react-native"
import { useSimpleTheme } from "../../lib/SimpleThemeContext"
import { HomeIcon, PantryIcon, ListsIcon, MoreIcon, AllergiesIcon, RecipesIcon } from "../../components/NavigationIcons"
import { config } from "../../config"

// Glassmorphism Tab Icon Component – uses tab bar tint (green when active, grey when inactive)
function ProfessionalTabIcon({ iconComponent, isActive, color }: { iconComponent: React.ComponentType<{ size?: number; color?: string; isActive?: boolean }>; isActive: boolean; color?: string }) {
  const IconComponent = iconComponent
  const iconColor = color ?? '#6A9571'

  return (
    <View style={styles.tabItemContainer}>
      {/* Active background highlight */}
      {isActive && <View style={styles.activeBackground} />}
      
      {/* Icon */}
      <View style={styles.iconWrapper}>
        <IconComponent 
          size={18} 
          color={iconColor} 
          isActive={isActive}
        />
      </View>
    </View>
  )
}

export default function TabsLayout() {
  const { isDark, colors } = useSimpleTheme()
  
  return (
    <Tabs screenOptions={{ 
      tabBarStyle:{ 
        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
        borderTopColor: 'rgba(0, 0, 0, 0.08)',
        borderTopWidth: 0.5,
        paddingTop: 8,
        paddingBottom: 8,
        paddingHorizontal: 12,
        height: 70,
        position: 'absolute',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 10,
        borderRadius: 35,
        marginHorizontal: 20,
        marginBottom: 34,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(40px)',
      }, 
      tabBarActiveTintColor: '#6A9571', 
      tabBarInactiveTintColor: '#8E8E93', 
      headerShown: false,
      tabBarLabelStyle: { 
        fontSize: 10, 
        fontWeight: '500', 
        marginTop: 4,
        letterSpacing: 0,
        textTransform: 'none',
      },
      tabBarItemStyle: {
        paddingVertical: 4,
        paddingHorizontal: 4,
        borderRadius: 20,
        marginHorizontal: 2,
      }
    }}>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: "Home", 
          tabBarIcon: ({ focused, color }) => <ProfessionalTabIcon iconComponent={HomeIcon} isActive={focused} color={color} />
        }} 
      />
      {/* Recipes tab: shown when EXPO_PUBLIC_ENABLE_RECIPES=true */}
      <Tabs.Screen 
        name="recipes" 
        options={{ 
          title: "Recipes",
          href: config.enableRecipes ? "/(tabs)/recipes" : null,
          tabBarIcon: ({ focused, color }) => <ProfessionalTabIcon iconComponent={RecipesIcon} isActive={focused} color={color} />,
        }} 
      />
      <Tabs.Screen 
        name="allergies" 
        options={{ 
          title: "Allergies", 
          tabBarIcon: ({ focused, color }) => <ProfessionalTabIcon iconComponent={AllergiesIcon} isActive={focused} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="pantry" 
        options={{ 
          title: "Pantry", 
          tabBarIcon: ({ focused, color }) => <ProfessionalTabIcon iconComponent={PantryIcon} isActive={focused} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="lists" 
        options={{ 
          title: "Lists", 
          tabBarIcon: ({ focused, color }) => <ProfessionalTabIcon iconComponent={ListsIcon} isActive={focused} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="more" 
        options={{ 
          title: "More", 
          tabBarIcon: ({ focused, color }) => <ProfessionalTabIcon iconComponent={MoreIcon} isActive={focused} color={color} />
        }} 
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabItemContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  activeBackground: {
    position: 'absolute',
    top: 2,
    left: 4,
    right: 4,
    bottom: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(106, 149, 113, 0.15)',
    shadowColor: '#6A9571',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
})
