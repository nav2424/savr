/**
 * SMTP Configuration Diagnostics
 * Helps identify and troubleshoot email verification issues
 */

import { supabase } from './supabase'

export interface SmtpDiagnostics {
  isConfigured: boolean
  issues: string[]
  recommendations: string[]
  canTest: boolean
}

/**
 * Diagnose SMTP configuration issues
 * Note: This checks for common error patterns, not actual SMTP connectivity
 */
export async function diagnoseSmtpConfiguration(): Promise<SmtpDiagnostics> {
  const issues: string[] = []
  const recommendations: string[] = []

  // Try to sign up a test user to see if we get SMTP errors
  // This is a diagnostic function, so we'll check error patterns
  let isConfigured = true
  let canTest = false

  // Check 1: Verify we can make auth calls
  try {
    const { error } = await supabase.auth.signUp({
      email: 'test-diagnostic-' + Date.now() + '@example.com',
      password: 'test-password-123',
      options: {
        emailRedirectTo: undefined,
      }
    })

    // If we get an SMTP-related error, SMTP might not be configured
    if (error) {
      const errorMessage = error.message?.toLowerCase() || ''
      
      if (errorMessage.includes('smtp') || 
          errorMessage.includes('email') && errorMessage.includes('send') ||
          errorMessage.includes('confirmation')) {
        isConfigured = false
        issues.push('SMTP configuration appears to be missing or incorrect')
        recommendations.push('Go to Supabase Dashboard → Settings → Auth → SMTP Settings')
        recommendations.push('Enable "Custom SMTP" and configure your email provider')
      }
    }
  } catch (error: any) {
    // If we can't even make the call, there might be a different issue
    issues.push('Unable to test SMTP configuration')
    recommendations.push('Check your Supabase connection and API keys')
  }

  // General recommendations
  if (!isConfigured) {
    recommendations.push('See SMTP_SETUP_COMPLETE.md for detailed setup instructions')
    recommendations.push('Recommended: Use Resend (free tier: 3,000 emails/month)')
    recommendations.push('Quick test: Use Gmail with App Password (500 emails/day limit)')
  }

  return {
    isConfigured,
    issues,
    recommendations,
    canTest: true,
  }
}

/**
 * Get user-friendly error message for SMTP issues
 */
export function getSmtpErrorMessage(error: any): string {
  const errorMessage = error?.message?.toLowerCase() || ''
  const errorCode = error?.code || error?.status || ''
  
  // Check error object and nested error messages
  const fullErrorText = JSON.stringify(error).toLowerCase()

  // Check for Resend testing email restrictions
  if (errorMessage.includes('can only send testing emails to your own email') ||
      errorMessage.includes('testing emails to your own email address') ||
      fullErrorText.includes('can only send testing emails')) {
    return 'RESEND_TESTING_EMAIL_RESTRICTION'
  }
  
  // Check for domain verification issues (Resend)
  if (errorMessage.includes('domain is not verified') || 
      errorMessage.includes('domain not verified') ||
      fullErrorText.includes('domain is not verified') ||
      fullErrorText.includes('resend.com/domains')) {
    return 'RESEND_DOMAIN_NOT_VERIFIED'
  }

  if (errorMessage.includes('smtp') || errorMessage.includes('email') && errorMessage.includes('send')) {
    return 'SMTP_NOT_CONFIGURED'
  }

  if (errorMessage.includes('authentication failed') || errorCode === '535') {
    return 'SMTP_AUTH_FAILED'
  }

  if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
    return 'SMTP_CONNECTION_FAILED'
  }

  if (errorMessage.includes('sender') || errorMessage.includes('not verified')) {
    return 'SMTP_SENDER_NOT_VERIFIED'
  }

  return 'SMTP_UNKNOWN_ERROR'
}

/**
 * Get setup instructions based on error type
 */
export function getSmtpSetupInstructions(errorType: string): string[] {
  const instructions: Record<string, string[]> = {
    RESEND_TESTING_EMAIL_RESTRICTION: [
      '1. Resend free tier only allows sending to your verified email',
      '2. Option A: Test with your verified email (arnavsalouja@gmail.com)',
      '3. Option B: Verify your domain to send to any email',
      '4. Go to https://resend.com/domains to verify domain',
      '5. See RESEND_DOMAIN_VERIFICATION_FIX.md for domain setup',
    ],
    RESEND_DOMAIN_NOT_VERIFIED: [
      '1. Quick Fix: Change Sender Email to onboarding@resend.dev in Supabase',
      '2. Or verify your domain in Resend: https://resend.com/domains',
      '3. Add DNS records to your domain registrar',
      '4. Wait for verification (5-30 minutes)',
      '5. See RESEND_DOMAIN_VERIFICATION_FIX.md for details',
    ],
    SMTP_NOT_CONFIGURED: [
      '1. Go to Supabase Dashboard → Settings → Auth → SMTP Settings',
      '2. Enable "Custom SMTP"',
      '3. Configure your email provider (Resend recommended)',
      '4. See SMTP_SETUP_COMPLETE.md for detailed steps',
    ],
    SMTP_AUTH_FAILED: [
      '1. Check your SMTP password/API key is correct',
      '2. For Gmail: Make sure you\'re using App Password, not regular password',
      '3. For Resend: Verify API key starts with `re_`',
      '4. Regenerate credentials if needed',
    ],
    SMTP_CONNECTION_FAILED: [
      '1. Verify SMTP host is correct (e.g., smtp.resend.com)',
      '2. Try port 587 instead of 465 (or vice versa)',
      '3. Check firewall/network settings',
      '4. Verify your SMTP provider is online',
    ],
    SMTP_SENDER_NOT_VERIFIED: [
      '1. For Resend: Use onboarding@resend.dev for testing',
      '2. For Gmail: Use the same email you created the app password for',
      '3. Verify sender email in your SMTP provider dashboard',
      '4. For production: Verify your domain with SPF/DKIM records',
    ],
  }

  return instructions[errorType] || [
    '1. Check Supabase Dashboard → Settings → Auth → SMTP Settings',
    '2. Verify all SMTP credentials are correct',
    '3. See SMTP_SETUP_COMPLETE.md for troubleshooting',
  ]
}

