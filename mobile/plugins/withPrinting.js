const { withInfoPlist } = require("expo/config-plugins");

// Config plugin: adds the iOS Info.plist entries LAN/Bluetooth thermal printers
// (Star StarXpand, Epson ePOS) require, so a dev/production build can discover and
// talk to them. Permission strings + Bonjour service types only — no SDK linking
// here (that lands with the native module). Validated by `expo prebuild`.
const BONJOUR_SERVICES = [
  "_raw-tcp._tcp", // Star / generic raw 9100
  "_pdl-datastream._tcp", // Epson / HP PDL
  "_ipp._tcp", // IPP
  "_printer._tcp",
];

module.exports = function withPrinting(config) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    plist.NSLocalNetworkUsageDescription =
      plist.NSLocalNetworkUsageDescription ||
      "Surge POS uses the local network to find and print to your receipt and kitchen printers.";
    plist.NSBluetoothAlwaysUsageDescription =
      plist.NSBluetoothAlwaysUsageDescription ||
      "Surge POS connects to Bluetooth receipt and kitchen printers.";
    const existing = Array.isArray(plist.NSBonjourServices) ? plist.NSBonjourServices : [];
    plist.NSBonjourServices = Array.from(new Set([...existing, ...BONJOUR_SERVICES]));
    return cfg;
  });
};
