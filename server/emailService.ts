/**
 * Email Service Integration
 *
 * Provides email sending capabilities via Resend or fallback logging.
 * Designed to integrate with weekly digest job and other notification needs.
 *
 * Environment Variables:
 * - RESEND_API_KEY: API key from Resend (https://resend.com)
 * - EMAIL_FROM: Default sender address (e.g., "ElevatED <noreply@elevated.family>")
 * - EMAIL_ENABLED: Set to "true" to enable actual email sending
 */

import process from 'node:process';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export interface EmailPayload {
    to: string;
    subject: string;
    body: string;
    html?: string;
    replyTo?: string;
    tags?: { name: string; value: string }[];
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export interface EmailBatchResult {
    total: number;
    sent: number;
    failed: number;
    results: EmailResult[];
}

// -------------------------------------------------------------------
// Configuration
// -------------------------------------------------------------------

const getConfig = () => ({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || 'ElevatED <noreply@elevated.family>',
    enabled: process.env.EMAIL_ENABLED === 'true',
    baseUrl: 'https://api.resend.com',
});

// -------------------------------------------------------------------
// Email Provider: Resend
// -------------------------------------------------------------------

async function sendViaResend(payload: EmailPayload): Promise<EmailResult> {
    const config = getConfig();

    if (!config.apiKey) {
        return {
            success: false,
            error: 'RESEND_API_KEY not configured',
        };
    }

    try {
        const response = await fetch(`${config.baseUrl}/emails`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: config.from,
                to: [payload.to],
                subject: payload.subject,
                text: payload.body,
                html: payload.html ?? formatTextAsHtml(payload.body),
                reply_to: payload.replyTo,
                tags: payload.tags,
            }),
        });

        const data = (await response.json()) as { id?: string; message?: string };

        if (!response.ok) {
            return {
                success: false,
                error: data.message || `HTTP ${response.status}`,
            };
        }

        return {
            success: true,
            messageId: data.id,
        };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error sending email',
        };
    }
}

// -------------------------------------------------------------------
// HTML Formatting Helper
// -------------------------------------------------------------------

function formatTextAsHtml(text: string): string {
    const paragraphs = text.split('\n\n').map((p) => {
        // Convert single newlines to <br>
        const lines = p.trim().split('\n');
        const formattedLines = lines.map((line) => {
            // Handle bullet points
            if (line.startsWith('• ')) {
                return `<li>${escapeHtml(line.slice(2))}</li>`;
            }
            return escapeHtml(line);
        });

        // If we have list items, wrap in <ul>
        if (formattedLines.some((l) => l.startsWith('<li>'))) {
            const listItems = formattedLines.filter((l) => l.startsWith('<li>'));
            const nonListItems = formattedLines.filter((l) => !l.startsWith('<li>'));
            return (
                (nonListItems.length ? `<p>${nonListItems.join('<br>')}</p>` : '') +
                (listItems.length ? `<ul style="padding-left: 20px;">${listItems.join('')}</ul>` : '')
            );
        }

        return `<p>${formattedLines.join('<br>')}</p>`;
    });

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        p { margin: 0 0 16px 0; }
        ul { margin: 0 0 16px 0; }
        li { margin: 4px 0; }
        a { color: #2563eb; }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 24px;
          border-radius: 12px 12px 0 0;
          text-align: center;
        }
        .content {
          background: #f9fafb;
          padding: 24px;
          border-radius: 0 0 12px 12px;
          border: 1px solid #e5e7eb;
          border-top: none;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white !important;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          margin: 16px 0;
        }
        .footer {
          text-align: center;
          color: #9ca3af;
          font-size: 12px;
          margin-top: 24px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0; font-size: 24px;">📚 ElevatED</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Weekly Learning Snapshot</p>
      </div>
      <div class="content">
        ${paragraphs.join('')}
        <div style="text-align: center;">
          <a href="https://app.elevated.family/parent" class="cta-button">
            View Full Dashboard →
          </a>
        </div>
      </div>
      <div class="footer">
        <p>You're receiving this because you have learners on ElevatED.</p>
        <p>
          <a href="https://app.elevated.family/settings/notifications">
            Manage notification preferences
          </a>
        </p>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// -------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------

/**
 * Send a single email.
 * If EMAIL_ENABLED is not "true", logs the email instead of sending.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
    const config = getConfig();

    if (!config.enabled) {
        console.log(`[email-service] [DRY RUN] Would send email to: ${payload.to}`);
        console.log(`  Subject: ${payload.subject}`);
        console.log(`  Body preview: ${payload.body.slice(0, 100)}...`);
        return {
            success: true,
            messageId: `dry-run-${Date.now()}`,
        };
    }

    console.log(`[email-service] Sending email to: ${payload.to}`);
    const result = await sendViaResend(payload);

    if (result.success) {
        console.log(`[email-service] ✓ Sent (ID: ${result.messageId})`);
    } else {
        console.error(`[email-service] ✗ Failed: ${result.error}`);
    }

    return result;
}

/**
 * Send multiple emails with rate limiting.
 * Resend has a 10 req/second limit, so we batch with delays.
 */
export async function sendBatchEmails(
    payloads: EmailPayload[],
    options?: { batchSize?: number; delayMs?: number }
): Promise<EmailBatchResult> {
    const batchSize = options?.batchSize ?? 10;
    const delayMs = options?.delayMs ?? 1100; // Just over 1 second to stay under rate limit

    const results: EmailResult[] = [];
    let sent = 0;
    let failed = 0;

    console.log(`[email-service] Starting batch send of ${payloads.length} emails...`);

    for (let i = 0; i < payloads.length; i += batchSize) {
        const batch = payloads.slice(i, i + batchSize);

        // Send batch in parallel
        const batchResults = await Promise.all(batch.map((payload) => sendEmail(payload)));

        for (const result of batchResults) {
            results.push(result);
            if (result.success) {
                sent++;
            } else {
                failed++;
            }
        }

        // Log progress
        const progress = Math.min(i + batchSize, payloads.length);
        console.log(`[email-service] Progress: ${progress}/${payloads.length} (${sent} sent, ${failed} failed)`);

        // Rate limit delay (except for last batch)
        if (i + batchSize < payloads.length) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    console.log(`[email-service] Batch complete: ${sent} sent, ${failed} failed`);

    return {
        total: payloads.length,
        sent,
        failed,
        results,
    };
}

/**
 * Check if email service is properly configured.
 */
export function isEmailConfigured(): { configured: boolean; enabled: boolean; issues: string[] } {
    const config = getConfig();
    const issues: string[] = [];

    if (!config.apiKey) {
        issues.push('RESEND_API_KEY not set');
    }

    if (!config.enabled) {
        issues.push('EMAIL_ENABLED is not "true" (dry-run mode)');
    }

    return {
        configured: issues.filter((i) => i.includes('API_KEY')).length === 0,
        enabled: config.enabled,
        issues,
    };
}

// -------------------------------------------------------------------
// Test / CLI
// -------------------------------------------------------------------

if (require.main === module) {
    const testEmail = process.argv[2];

    if (!testEmail) {
        console.log('Usage: npx tsx server/emailService.ts <test-email>');
        console.log('\nStatus:');
        const status = isEmailConfigured();
        console.log(`  Configured: ${status.configured}`);
        console.log(`  Enabled: ${status.enabled}`);
        if (status.issues.length) {
            console.log(`  Issues: ${status.issues.join(', ')}`);
        }
        process.exit(0);
    }

    console.log(`\nSending test email to: ${testEmail}\n`);

    sendEmail({
        to: testEmail,
        subject: 'ElevatED Test Email',
        body: `Hi there!

This is a test email from ElevatED's email service.

Here are some highlights:
• The email service is working correctly
• HTML formatting is applied automatically
• Weekly digests will look similar to this

Next steps:
• Check that the email looks good
• Verify the links work properly

Thanks for testing!

—The ElevatED Team`,
    })
        .then((result) => {
            if (result.success) {
                console.log('✅ Test email sent successfully!');
                console.log(`   Message ID: ${result.messageId}`);
            } else {
                console.log('❌ Failed to send test email');
                console.log(`   Error: ${result.error}`);
            }
        })
        .catch(console.error);
}
