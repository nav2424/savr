import React from "react"
import { Tabs } from "expo-router"
import { Text, View, StyleSheet, Animated } from "react-native"
import { useSimpleTheme } from "../../lib/SimpleThemeContext"
import { HomeIcon, PantryIcon, ListsIcon, MoreIcon, AllergiesIcon } from "../../components/NavigationIcons"

// Glassmorphism Tab Icon Component
function ProfessionalTabIcon({ iconComponent, isActive }: { iconComponent: React.ComponentType<{ size?: number; color?: string; isActive?: boolean }>; isActive: boolean }) {
  const IconComponent = iconComponent

  return (
    <View style={styles.tabItemContainer}>
      {/* Active background highlight */}
      {isActive && <View style={styles.activeBackground} />}
      
      {/* Icon */}
      <View style={styles.iconWrapper}>
        <IconComponent 
          size={18} 
          color='#6A9571' 
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
      tabBarInactiveTintColor: '#6A9571', 
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
          tabBarIcon: ({ focused }) => <ProfessionalTabIcon iconComponent={HomeIcon} isActive={focused} />
        }} 
      />
      {/* Recipes tab excluded - file exists but not shown in navigation */}
      <Tabs.Screen 
        name="recipes" 
        options={{ 
          href: null, // Prevents auto-registration from showing in tab bar
        }} 
      />
      <Tabs.Screen 
        name="allergies" 
        options={{ 
          title: "Allergies", 
          tabBarIcon: ({ focused }) => <ProfessionalTabIcon iconComponent={AllergiesIcon} isActive={focused} />
        }} 
      />
      <Tabs.Screen 
        name="pantry" 
        options={{ 
          title: "Pantry", 
          tabBarIcon: ({ focused }) => <ProfessionalTabIcon iconComponent={PantryIcon} isActive={focused} />
        }} 
      />
      <Tabs.Screen 
        name="lists" 
        options={{ 
          title: "Lists", 
          tabBarIcon: ({ focused }) => <ProfessionalTabIcon iconComponent={ListsIcon} isActive={focused} />
        }} 
      />
      <Tabs.Screen 
        name="more" 
        options={{ 
          title: "More", 
          tabBarIcon: ({ focused }) => <ProfessionalTabIcon iconComponent={MoreIcon} isActive={focused} />
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
