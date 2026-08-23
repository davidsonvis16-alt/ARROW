import { supabase } from '../lib/supabase';
import { ReportReason } from '../types';

export const reportService = {
  /**
   * Submit a private moderation report
   * RLS ensures reports are private and cannot be read by other users
   */
  async reportUser(
    reporterId: string,
    reportedId: string,
    reason: ReportReason,
    details?: string
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase client is not configured');
    }

    if (reporterId === reportedId) {
      throw new Error('Cannot report yourself');
    }

    const { error } = await supabase.from('arrow_reports').insert({
      reporter_id: reporterId,
      reported_id: reportedId,
      reason,
      details: details || '',
      status: 'pending',
    });

    if (error) {
      console.error('Error submitting report:', error);
      throw error;
    }
  },
};
