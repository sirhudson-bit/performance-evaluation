import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SMS_BASE_URL,
  isWithinSmsWindow,
  isValidMobile,
  normalizePhone,
  otpMessage,
  parseProviderResponse,
  smsEndpoint,
} from '../../apps/api/src/lib/sms.js';

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

describe('smsEndpoint', () => {
  it('uses the documented operation path on the official host', () => {
    expect(smsEndpoint('https://rest.payamak-panel.com/api/SendSMS/SendOtp', 'SendSMS')).toBe(
      'https://rest.payamak-panel.com/api/SendSMS/SendSMS',
    );
    expect(smsEndpoint('https://rest.payamak-panel.com/api/SendSMS/SendOtp', 'BaseServiceNumber')).toBe(
      'https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber',
    );
  });

  it('never posts to the documentation site', () => {
    expect(smsEndpoint('https://www.melipayamak.com/api/', 'SendSMS')).toBe(DEFAULT_SMS_BASE_URL);
  });

  it('appends an operation once on a custom host', () => {
    expect(smsEndpoint('https://sms.example.com/api', 'SendSMS')).toBe('https://sms.example.com/api/SendSMS');
    expect(smsEndpoint('https://sms.example.com/api/SendOtp', 'SendSMS')).toBe('https://sms.example.com/api/SendSMS');
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


describe('isWithinSmsWindow', () => {
  const base = { windowStart: '08:00', windowEnd: '20:00' };
  it('allows messages inside the window and rejects outside it (Tehran time)', () => {
    expect(isWithinSmsWindow({ ...base, windowEnabled: true }, new Date('2026-01-01T06:00:00Z'))).toBe(true); // 09:30
    expect(isWithinSmsWindow({ ...base, windowEnabled: true }, new Date('2026-01-01T17:00:00Z'))).toBe(false); // 20:30
  });

  it('supports an overnight window', () => {
    const overnight = { windowEnabled: true, windowStart: '20:00', windowEnd: '08:00' };
    expect(isWithinSmsWindow(overnight, new Date('2026-01-01T17:30:00Z'))).toBe(true); // 21:00
    expect(isWithinSmsWindow(overnight, new Date('2026-01-01T08:30:00Z'))).toBe(false); // 12:00
  });

  it('does not restrict when disabled', () => {
    expect(isWithinSmsWindow({ ...base, windowEnabled: false }, new Date('2026-01-01T17:00:00Z'))).toBe(true);
  });
});
