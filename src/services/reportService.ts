import { rpc } from './rpc';
import { ReportReason } from '../types';

export const reportService = {
  /**
   * File a moderation report. Blocking alongside it is the default: someone
   * worth reporting is someone you should stop hearing from immediately.
   */
  async reportUser(
    reportedId: string,
    reason: ReportReason,
    details?: string,
    alsoBlock = true
  ): Promise<void> {
    await rpc('arrow_report_user', {
      p_target_id: reportedId,
      p_reason: reason,
      p_details: details || '',
      p_also_block: alsoBlock,
    });
  },
};
