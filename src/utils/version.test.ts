import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveVersion, injectVersion } from "./version";

const entrypoints = ["index.html", "auth-callback.html"];
const dockerfile = readFileSync(resolve(__dirname, "../../docker/Dockerfile.build"), "utf8");
const builderStage = dockerfile.slice(0, dockerfile.indexOf("\nFROM ", 1));

describe.each(entrypoints)("entrypoint %s version injection", file => {
  const html = readFileSync(resolve(__dirname, "../entrypoints", file), "utf8");

  it("contains js-version element", () => {
    expect(html).toContain('id="js-version"');
  });

  it("version is injected and placeholder is removed", () => {
    const version = resolveVersion();
    const transformed = injectVersion(html, version);

    expect(transformed).not.toContain("__KETESA_VERSION__");
    expect(transformed).toContain(version);
  });

  it("preserves the exact configured version", () => {
    const version = "v9.8.7-build.42";
    const transformed = injectVersion(html, version);

    expect(transformed).not.toContain("__KETESA_VERSION__");
    expect(transformed).toContain(`textContent = ${JSON.stringify(version)};`);
  });
});

describe("Docker builder version configuration", () => {
  it("passes VERSION into the builder before yarn build", () => {
    const versionArg = builderStage.indexOf("ARG VERSION=dev");
    const vcsRefArg = builderStage.indexOf("ARG VCS_REF=unknown");
    const versionEnv = builderStage.indexOf("ENV KETESA_VERSION=$VERSION");
    const legacyVersionEnv = builderStage.indexOf("ENV SYNAPSE_ADMIN_VERSION=$VERSION");
    const yarnBuild = builderStage.indexOf("yarn build");

    expect(versionArg).toBeGreaterThanOrEqual(0);
    expect(vcsRefArg).toBeGreaterThan(versionArg);
    expect(versionEnv).toBeGreaterThan(vcsRefArg);
    expect(legacyVersionEnv).toBeGreaterThan(versionEnv);
    expect(yarnBuild).toBeGreaterThan(legacyVersionEnv);
  });
});

describe("configured version resolution", () => {
  it("uses the Docker-provided version even when Git metadata is available", () => {
    const originalKetesaVersion = process.env.KETESA_VERSION;
    const originalSynapseAdminVersion = process.env.SYNAPSE_ADMIN_VERSION;
    process.env.KETESA_VERSION = "v9.8.7-build.42";
    process.env.SYNAPSE_ADMIN_VERSION = "legacy-version";

    try {
      expect(resolveVersion()).toBe("v9.8.7-build.42");
    } finally {
      if (originalKetesaVersion === undefined) delete process.env.KETESA_VERSION;
      else process.env.KETESA_VERSION = originalKetesaVersion;
      if (originalSynapseAdminVersion === undefined) delete process.env.SYNAPSE_ADMIN_VERSION;
      else process.env.SYNAPSE_ADMIN_VERSION = originalSynapseAdminVersion;
    }
  });
});
