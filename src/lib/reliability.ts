import trackEvent from './analytics';
import { captureClientException, captureClientMessage, isMonitoringEnabled } from '../monitoring';

type ReliabilityStage =
  | 'auth_login'
  | 'auth_register'
  | 'auth_login_email_not_confirmed'
  | 'auth_resend_verification'
  | 'diagnostic_load'
  | 'lesson_playback'
  | 'adaptive_path';

type ReliabilityStatus = 'success' | 'error';

export const recordReliabilityCheckpoint = (
  stage: ReliabilityStage,
  status: ReliabilityStatus,
  detail?: Record<string, unknown>,
): void => {
  trackEvent(`reliability_${stage}`, { status, ...detail });

  if (!isMonitoringEnabled()) {
    return;
  }

  if (status === 'error') {
    captureClientMessage(`[reliability] ${stage} failure`, detail, 'error');
    if (detail?.error instanceof Error) {
      captureClientException(detail.error, { stage, ...detail });
    }
  } else {
    captureClientMessage(`[reliability] ${stage} success`, detail, 'info');
  }
};

export default recordReliabilityCheckpoint;
