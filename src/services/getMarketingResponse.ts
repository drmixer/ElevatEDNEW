import supabase from '../lib/supabaseClient';

export type MarketingResponseResult = {
  message: string;
  model: string;
};

export const getMarketingResponse = async (question: string): Promise<MarketingResponseResult> => {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error('Question must be a non-empty string.');
  }

  const { data, error } = await supabase.functions.invoke<MarketingResponseResult>('marketing-assistant', {
    body: { question: trimmed },
  });

  if (error) {
    throw new Error(error.message ?? 'Assistant unavailable.');
  }

  if (!data?.message) {
    throw new Error('Assistant unavailable. Please try again shortly.');
  }

  return data;
};

export default getMarketingResponse;
