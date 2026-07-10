// Phase 1 — wallet-less customer import (Square migration). Covers the parser changes: no
// street-address→wallet mis-map, placeholder generation, consent/spend/visit parsing, and the
// validation rules (contactless skip, placeholder-with-contact passes, malformed real wallet rejected).

import {
  parseCustomerExcel,
  validateCustomerRow,
  mapColumnHeaders,
  sanitizeCustomerData,
  isPlaceholderWallet,
  extractHeadersAndSamples,
} from '../../src/utils/customerExcelParser';

describe('mapColumnHeaders', () => {
  it('does NOT map a street-address column to the wallet field', () => {
    const m = mapColumnHeaders(['First Name', 'Email Address', 'Street Address 1', 'Phone Number']);
    expect(m.walletAddress).toBeUndefined(); // 'Address' alias removed
    expect(m.email).toBe('Email Address');
    expect(m.phone).toBe('Phone Number');
    expect(m.firstName).toBe('First Name');
  });
  it('maps Square migration columns', () => {
    const m = mapColumnHeaders(['Square Customer ID', 'Email Subscription Status', 'Lifetime Spend', 'Last Visit', 'Mobile Number']);
    expect(m.externalRef).toBe('Square Customer ID');
    expect(m.marketingEmailConsent).toBe('Email Subscription Status');
    expect(m.lifetimeSpendUsd).toBe('Lifetime Spend');
    expect(m.lastVisitAt).toBe('Last Visit');
    expect(m.phone).toBe('Mobile Number');
  });
});

describe('parseCustomerExcel — wallet-less rows', () => {
  it('generates a placeholder wallet + parses consent/spend/visit for a Square-shaped row', async () => {
    const csv =
      'First Name,Last Name,Email Address,Phone Number,Email Subscription Status,Lifetime Spend,Last Visit\n' +
      'Jane,Doe,jane@x.com,+1 555 010 0001,Subscribed,"$1,234.50",2026-01-15\n';
    const rows = await parseCustomerExcel(Buffer.from(csv), 'csv');
    expect(rows.length).toBe(1);
    const r = rows[0];
    expect(r.walletProvided).toBe(false);
    expect(isPlaceholderWallet(r.walletAddress)).toBe(true);
    expect(r.email).toBe('jane@x.com');
    expect(r.phone).toContain('555');
    expect(r.marketingEmailConsent).toBe(true);
    expect(r.lifetimeSpendUsd).toBe(1234.5);
    expect(r.lastVisitAt).toBeTruthy();
  });

  it('marks an unsubscribed customer as no consent', async () => {
    const rows = await parseCustomerExcel(Buffer.from('Email Address,Email Subscription Status\na@b.com,Unsubscribed\n'), 'csv');
    expect(rows[0].marketingEmailConsent).toBe(false);
  });

  it('keeps a named-but-contactless row (for reporting), not silently dropped', async () => {
    const rows = await parseCustomerExcel(Buffer.from('First Name,Last Name,Email Address,Phone Number\nJohn,NoContact,,\n'), 'csv');
    expect(rows.length).toBe(1);
    expect(rows[0].walletProvided).toBe(false);
  });
});

describe('validateCustomerRow', () => {
  it('passes a wallet-less row that has a contact', async () => {
    const rows = await parseCustomerExcel(Buffer.from('Email Address\nok@x.com\n'), 'csv');
    const v = validateCustomerRow(sanitizeCustomerData(rows[0]));
    expect(v.isValid).toBe(true);
  });

  it('flags a wallet-less row with no email/phone as MISSING_CONTACT', async () => {
    const rows = await parseCustomerExcel(Buffer.from('First Name\nGhost\n'), 'csv');
    const v = validateCustomerRow(sanitizeCustomerData(rows[0]));
    expect(v.isValid).toBe(false);
    expect(v.errors.some((e) => e.code === 'MISSING_CONTACT')).toBe(true);
  });

  it('rejects a real but malformed wallet', () => {
    const row: any = { rowIndex: 2, walletAddress: '0x123', walletProvided: true, tier: 'BRONZE', lifetimeEarnings: 0, active: true };
    const v = validateCustomerRow(row);
    expect(v.errors.some((e) => e.code === 'INVALID_WALLET_ADDRESS')).toBe(true);
  });

  it('accepts a valid real wallet', () => {
    const row: any = { rowIndex: 2, walletAddress: '0x' + 'a'.repeat(40), walletProvided: true, email: 'a@b.com', tier: 'BRONZE', lifetimeEarnings: 0, active: true };
    const v = validateCustomerRow(sanitizeCustomerData(row));
    expect(v.isValid).toBe(true);
  });
});

describe('Phase 2 — explicit mapping override + sample extraction', () => {
  it('mapColumnHeaders: explicit override wins; hallucinated header dropped; "" clears a field', () => {
    const headers = ['Customer First', 'E', 'Mobile No'];
    const m = mapColumnHeaders(headers, { firstName: 'Customer First', email: 'E', phone: 'NOT A HEADER', name: '' });
    expect(m.firstName).toBe('Customer First'); // overridden onto a non-standard header
    expect(m.email).toBe('E');
    expect(m.phone).toBeUndefined();            // hallucinated header ignored
    expect(m.name).toBeUndefined();             // empty clears
  });

  it('parseCustomerExcel honors an override for non-standard headers', async () => {
    const csv = 'Customer First,Customer Last,E\nJane,Doe,jane@x.com\n';
    const rows = await parseCustomerExcel(Buffer.from(csv), 'csv', {
      firstName: 'Customer First', lastName: 'Customer Last', email: 'E',
    });
    expect(rows.length).toBe(1);
    expect(rows[0].firstName).toBe('Jane');
    expect(rows[0].email).toBe('jane@x.com');
    expect(rows[0].walletProvided).toBe(false);
    expect(isPlaceholderWallet(rows[0].walletAddress)).toBe(true);
  });

  it('extractHeadersAndSamples returns headers + sample rows', () => {
    const csv = 'First Name,Email Address\nAda,ada@x.com\nGrace,grace@x.com\n';
    const { headers, samples } = extractHeadersAndSamples(Buffer.from(csv), 'csv', 5);
    expect(headers).toEqual(['First Name', 'Email Address']);
    expect(samples.length).toBe(2);
    expect(samples[0]['First Name']).toBe('Ada');
    expect(samples[0]['Email Address']).toBe('ada@x.com');
  });
});
