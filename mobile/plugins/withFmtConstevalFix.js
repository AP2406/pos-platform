const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// BUILD FIX (no runtime/behavior change).
//
// React Native 0.76.9 pins RCT-Folly 2024.10.14.00 → fmt 11.0.2. That fmt only
// disables its `consteval` path for "Apple clang < 14"
// (__apple_build_version__ < 14000029L). Apple clang 21 / Xcode 26 is far above
// that gate but rejects fmt's FMT_STRING consteval usage, giving 5 errors in
// Pods/fmt/include/fmt/format-inl.h:
//   "call to consteval function 'fmt::basic_format_string<...>' is not a
//    constant expression"
//
// FIX: setting the fmt target to C++17 does NOT work here — React Native injects
// an explicit `-std=c++20` into the fmt pod's OTHER_CPLUSPLUSFLAGS, which wins over
// CLANG_CXX_LANGUAGE_STANDARD, so __cplusplus stays 202002 and consteval stays on.
// And -DFMT_USE_CONSTEVAL=0 doesn't work either — fmt/base.h defines that macro
// UNGUARDED (no #ifndef), so the header always wins.
//
// The override-proof fix is to patch fmt's source directly: flip its
// `#define FMT_USE_CONSTEVAL 1` lines to 0 at pod-install time (idempotent; the
// header is re-downloaded on each `pod install`, so we re-apply every time). fmt
// then uses constexpr instead of consteval — compile-time format checking only,
// no runtime/behavior change.
//
// Remove once RN ships a folly/fmt bump (fmt >= 11.1 fixes clang-21 upstream).
const MARKER = "Surge build fix: fmt";

const SNIPPET = `
    # --- Surge build fix: fmt 11.0.2 consteval vs Apple clang 21 (Xcode 26) ---
    # Patch fmt to disable consteval (its FMT_USE_CONSTEVAL define is unguarded, so
    # a -D flag can't override it; a C++17 build setting is clobbered by RN's
    # -std=c++20). Compile-time only. See plugins/withFmtConstevalFix.js.
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      fmt_txt = File.read(fmt_base)
      if fmt_txt.include?('#  define FMT_USE_CONSTEVAL 1')
        File.write(fmt_base, fmt_txt.gsub('#  define FMT_USE_CONSTEVAL 1', '#  define FMT_USE_CONSTEVAL 0'))
        Pod::UI.puts '[surge] patched fmt/base.h: FMT_USE_CONSTEVAL -> 0 (Apple clang 21 consteval fix)'
      end
    end
    # --- end Surge build fix ---
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      const contents = fs.readFileSync(podfile, "utf8");
      if (contents.includes(MARKER)) return cfg;

      const lines = contents.split("\n");
      const start = lines.findIndex((l) => l.trim() === "post_install do |installer|");
      if (start === -1) throw new Error("withFmtConstevalFix: no post_install block in the Podfile.");
      const close = lines.findIndex((l, i) => i > start && l === "  end");
      if (close === -1) throw new Error("withFmtConstevalFix: could not find the end of post_install.");

      lines.splice(close, 0, SNIPPET);
      fs.writeFileSync(podfile, lines.join("\n"));
      return cfg;
    },
  ]);
};
