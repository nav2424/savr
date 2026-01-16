import React from 'react'
import { View, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'

interface SageLeafIconProps {
  size?: number
  color?: string
}

export default function SageLeafIcon({ size = 24, color = '#4a9b8e' }: SageLeafIconProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {/* Central stem */}
        <Path
          d="M12 2 L12 22"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Top left leaf */}
        <Path
          d="M12 6 Q8 4 6 8 Q8 12 12 10"
          stroke={color}
          strokeWidth="1.5"
          fill={color}
          fillOpacity="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Top right leaf */}
        <Path
          d="M12 6 Q16 4 18 8 Q16 12 12 10"
          stroke={color}
          strokeWidth="1.5"
          fill={color}
          fillOpacity="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Bottom center leaf */}
        <Path
          d="M12 14 Q10 16 12 18 Q14 16 12 14"
          stroke={color}
          strokeWidth="1.5"
          fill={color}
          fillOpacity="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
})
