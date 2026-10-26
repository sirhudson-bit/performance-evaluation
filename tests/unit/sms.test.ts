import { describe, expect, it } from 'vitest';
import { isValidMobile, normalizePhone, otpMessage, parseProviderResponse } from '../../apps/api/src/lib/sms.js';

describe('normalizePhone', () => {
  it('normalises Iranian mobile formats to 09xxxxxxxxx', () => {
    expect(normalizePhone('09121234567')).toBe('09121234567');
    expect(normalizePhone('9121234567')).toBe('09121234567');
    expect(normalizePhone('+989121234567')).toBe('09121234567');
    expect(normalizePhone('00989121234567')).toBe('09121234567');
  });

  it('normalises Persian digits and separators', () => {
    expect(normalizePhone('۰۹۱۲ ۱۲۳ ۴۵۶۷')).toBe('09121234567');
    expect(normalizePhone('0912-123-4567')).toBe('09121234567');
  });

  it('rejects landlines and truncated numbers', () => {
    expect(isValidMobile('02112345678')).toBe(false);
    expect(isValidMobile('0912123456')).toBe(false);
    expect(isValidMobile('09121234567')).toBe(true);
  });
});

describe('otpMessage', () => {
  it('replaces the {code} placeholder', () => {
    expect(otpMessage('کد ورود: {code}', '123456')).toBe('کد ورود: 123456');
    expect(otpMessage('کد ورود: {code} (۲ دقیقه)', '123456')).toContain('123456');
  });

  it('appends the code when the template has no placeholder', () => {
    expect(otpMessage('کد ورود', '123456')).toBe('کد ورود 123456');
  });
});

describe('parseProviderResponse', () => {
  it('accepts a positive RecId', () => {
    expect(parseProviderResponse(200, { Value: '98765', RetStatus: 1, StrRetStatus: 'Ok' })).toEqual({
      sent: true,
      messageId: '98765',
    });
  });

  it('rejects a failed panel response', () => {
    const result = parseProviderResponse(200, { Value: 'اعتبار کافی نیست', RetStatus: 0, StrRetStatus: 'NoCredit' });
    expect(result.sent).toBe(false);
    expect(result.error).toContain('NoCredit');
  });

  it('rejects HTTP failures and missing ids', () => {
    expect(parseProviderResponse(500, {}).sent).toBe(false);
    expect(parseProviderResponse(200, { Value: '0', RetStatus: 1 }).sent).toBe(false);
    expect(parseProviderResponse(200, null).sent).toBe(false);
  });
});
