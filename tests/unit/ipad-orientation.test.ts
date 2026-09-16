import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The register must not rotate to portrait mid-service.
//
// This is tested against app.json rather than against the generated
// Info.plist because mobile/ios is gitignored — the native project is
// regenerated, so app.json is the only copy of this decision that survives.
//
// WHAT WENT WRONG, SO IT DOES NOT GO WRONG AGAIN. `expo.orientation:
// "landscape"` reads like it settles the question, and on iPhone it does: it
// narrows UISupportedInterfaceOrientations to the two landscape values. It does
// NOT narrow UISupportedInterfaceOrientations~ipad, which Expo emits with all
// four regardless — and the iPad is the device this app actually runs on. So
// the declared intent was landscape and the shipped behaviour was "rotates
// freely", which it did, during screenshot capture, on a real device.
//
// Two keys are needed and they are a pair:
//
//   UISupportedInterfaceOrientations~ipad   the actual restriction
//   UIRequiresFullScreen: true              Apple requires an iPad app that
//                                           supports multitasking (Slide Over,
//                                           Split View, Stage Manager) to
//                                           support all four orientations.
//                                           Restricting orientation without
//                                           opting out of multitasking is a
//                                           review rejection.
//
// Opting out of multitasking is the right trade for a till bolted to a counter,
// but it IS a trade: no Split View alongside Safari on the same iPad.

const LANDSCAPE = [
  "UIInterfaceOrientationLandscapeLeft",
  "UIInterfaceOrientationLandscapeRight",
];

type ExpoConfig = {
  expo: {
    orientation?: string;
    ios?: {
      supportsTablet?: boolean;
      requireFullScreen?: boolean;
      infoPlist?: Record<string, unknown>;
    };
  };
};

const cfg: ExpoConfig = JSON.parse(
  readFileSync(join(process.cwd(), "mobile/app.json"), "utf8")
);

describe("iPad orientation lock", () => {
  it("declares landscape at the top level, for iPhone", () => {
    expect(cfg.expo.orientation).toBe("landscape");
  });

  it("restricts the iPad orientations explicitly", () => {
    // The whole bug: without this key the top-level declaration is silently
    // ignored on tablets.
    const ipad = cfg.expo.ios?.infoPlist?.["UISupportedInterfaceOrientations~ipad"];
    expect(ipad, "UISupportedInterfaceOrientations~ipad is missing").toBeDefined();
    expect(ipad).toEqual(LANDSCAPE);
  });

  it("does not leave portrait in the iPad list", () => {
    const ipad = (cfg.expo.ios?.infoPlist?.["UISupportedInterfaceOrientations~ipad"] ??
      []) as string[];
    expect(ipad.join(",")).not.toMatch(/Portrait/);
  });

  it("opts out of multitasking, which the restriction requires", () => {
    // Not optional cosmetics: an iPad app that supports Split View must support
    // all four orientations, so restricting one without the other is rejected.
    expect(cfg.expo.ios?.requireFullScreen).toBe(true);
  });

  it("still declares tablet support at all", () => {
    // A guard on the guard: setting requireFullScreen while accidentally
    // dropping supportsTablet would ship an iPhone-only app to an iPad estate.
    expect(cfg.expo.ios?.supportsTablet).toBe(true);
  });
});
