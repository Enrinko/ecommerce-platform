// Pure helpers for the cleartext network-security config, kept free of any
// Expo/native imports so they can be unit-tested in isolation.

// Dev machine + Android emulator loopback. Cleartext is re-permitted only for
// these plus a plain-HTTP EXPO_PUBLIC_API_URL host; every other domain keeps the
// platform default (cleartext blocked).
const ALWAYS = ['localhost', '127.0.0.1', '10.0.2.2'];

function cleartextHosts(apiUrl = process.env.EXPO_PUBLIC_API_URL) {
  const hosts = new Set(ALWAYS);
  if (apiUrl) {
    try {
      const parsed = new URL(apiUrl);
      // Only http:// widens the allowlist; an https API leaves release locked down.
      if (parsed.protocol === 'http:') hosts.add(parsed.hostname);
    } catch {
      // Malformed URL: fall back to the dev defaults above.
    }
  }
  return [...hosts];
}

function buildNetworkSecurityConfig(hosts) {
  const domains = hosts.map((h) => `    <domain includeSubdomains="false">${h}</domain>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
${domains}
  </domain-config>
</network-security-config>
`;
}

module.exports = { cleartextHosts, buildNetworkSecurityConfig };
