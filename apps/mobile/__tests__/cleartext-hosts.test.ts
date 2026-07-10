// Unit tests for the Android cleartext allowlist logic. The security-critical
// guarantee: an https API must NOT widen the cleartext allowlist, so release
// builds pointed at a real endpoint keep plain-HTTP blocked.
const { cleartextHosts, buildNetworkSecurityConfig } = require('../plugins/cleartext-hosts');

const DEV_DEFAULTS = ['localhost', '127.0.0.1', '10.0.2.2'];

describe('cleartextHosts', () => {
  it('permits the dev/emulator loopback hosts by default', () => {
    expect(cleartextHosts(undefined)).toEqual(DEV_DEFAULTS);
  });

  it('adds a plain-HTTP API host to the allowlist', () => {
    const hosts = cleartextHosts('http://192.168.0.12:3000/api/v1');
    expect(hosts).toEqual([...DEV_DEFAULTS, '192.168.0.12']);
  });

  it('does NOT widen the allowlist for an https API', () => {
    expect(cleartextHosts('https://api.example.com/v1')).toEqual(DEV_DEFAULTS);
  });

  it('falls back to defaults for a malformed URL', () => {
    expect(cleartextHosts('not a url')).toEqual(DEV_DEFAULTS);
  });
});

describe('buildNetworkSecurityConfig', () => {
  it('blocks cleartext by default and permits it only for the given hosts', () => {
    const xml = buildNetworkSecurityConfig(['10.0.2.2', '192.168.0.12']);
    expect(xml).toContain('<base-config cleartextTrafficPermitted="false" />');
    expect(xml).toContain('<domain-config cleartextTrafficPermitted="true">');
    expect(xml).toContain('<domain includeSubdomains="false">10.0.2.2</domain>');
    expect(xml).toContain('<domain includeSubdomains="false">192.168.0.12</domain>');
  });
});
