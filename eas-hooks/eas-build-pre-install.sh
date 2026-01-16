#!/bin/bash

set -e

echo "🔧 Configuring iOS build for Folly compatibility..."

# Ensure we're in the right directory
cd $EAS_BUILD_WORKINGDIR

# Add Folly fix to Podfile if not already present
if [ -f "ios/Podfile" ]; then
    if ! grep -q "HEADER_SEARCH_PATHS.*RCT-Folly" ios/Podfile; then
        echo "Adding Folly header search paths to Podfile..."
        
        # Backup original Podfile
        cp ios/Podfile ios/Podfile.backup
        
        # Add the fix before the final 'end'
        sed -i '' '/^end$/i\
\    # Fix for Folly/coro/Coroutine.h not found error\
\    installer.pods_project.targets.each do |target|\
\      target.build_configurations.each do |config|\
\        config.build_settings['"'"'HEADER_SEARCH_PATHS'"'"'] ||= ['"'"'$(inherited)'"'"']\
\        config.build_settings['"'"'HEADER_SEARCH_PATHS'"'"'] << '"'"'"$(PODS_ROOT)/RCT-Folly"'"'"'\
\        config.build_settings['"'"'HEADER_SEARCH_PATHS'"'"'] << '"'"'"$(PODS_ROOT)/Headers/Public/RCT-Folly"'"'"'\
\      end\
\    end\
' ios/Podfile
        
        echo "✅ Podfile updated with Folly fix"
    else
        echo "✅ Folly fix already present in Podfile"
    fi
fi

echo "✅ iOS configuration complete"

