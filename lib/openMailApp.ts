/**
 * Open the user's mail client inbox (not compose). mailto: always opens "new message", so we try app URL schemes first.
 */
import { Platform, Linking, Alert } from 'react-native';

const IOS_MAIL_SCHEMES = [
  'message://',
  'googlegmail://',
  'ms-outlook://',
  'readdle-spark://',
] as const;

export async function openMailAppInbox(): Promise<void> {
  if (Platform.OS === 'ios') {
    for (const scheme of IOS_MAIL_SCHEMES) {
      try {
        const can = await Linking.canOpenURL(scheme);
        if (can) {
          await Linking.openURL(scheme);
          return;
        }
      } catch {
        /* try next */
      }
    }
    Alert.alert(
      'Open Mail',
      'Open the Mail app (or Gmail / Outlook) from your Home Screen and check your inbox and spam folder for the message from SAVR.'
    );
    return;
  }

  if (Platform.OS === 'android') {
    try {
      await Linking.openURL(
        'intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_EMAIL;end'
      );
      return;
    } catch {
      /* fall through */
    }
  }

  Alert.alert(
    'Check your email',
    'Open your email app and look for the verification message (check Spam / Junk too).'
  );
}
