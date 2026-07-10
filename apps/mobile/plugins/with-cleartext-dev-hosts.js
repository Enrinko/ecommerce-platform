const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const { cleartextHosts, buildNetworkSecurityConfig } = require('./cleartext-hosts');

// Android 9+ blocks plain-HTTP ("cleartext") traffic by default in release
// builds. This app talks to a plain-HTTP API on the local network during
// development, so it needs cleartext for THAT host — but enabling it app-wide
// (android:usesCleartextTraffic="true") would also permit downgrade/MITM against
// any future https endpoint. Instead we emit a networkSecurityConfig that keeps
// the platform default (cleartext blocked) for every domain and re-permits it
// only for known local/dev hosts. If EXPO_PUBLIC_API_URL is https, no extra host
// is added and release builds stay locked down.
module.exports = function withCleartextDevHosts(config) {
  // Point the manifest at the config and make sure app-wide cleartext stays off.
  config = withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    delete app.$['android:usesCleartextTraffic'];
    return cfg;
  });

  // Write res/xml/network_security_config.xml during prebuild.
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'network_security_config.xml'),
        buildNetworkSecurityConfig(cleartextHosts()),
      );
      return cfg;
    },
  ]);

  return config;
};
