import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { useCallback } from 'react';

export function useRecaptcha() {
  const { executeRecaptcha } = useGoogleReCaptcha();

  const executeCaptcha = useCallback(
    async (action: string = 'submit'): Promise<string | null> => {
      if (!executeRecaptcha) {
        console.warn('reCAPTCHA not yet loaded');
        return null;
      }

      try {
        const token = await executeRecaptcha(action);
        return token;
      } catch (error) {
        console.error('Failed to execute reCAPTCHA:', error);
        return null;
      }
    },
    [executeRecaptcha]
  );

  return { executeCaptcha };
}
