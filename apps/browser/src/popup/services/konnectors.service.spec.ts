// import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { AbstractStorageService as StorageService } from "@bitwarden/common/platform/abstractions/storage.service";
// import { SettingsService } from "@bitwarden/common/services/settings.service";
import { CipherType } from "@bitwarden/common/vault/enums/cipher-type";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { KonnectorsService } from "./konnectors.service";

const buildKonnectors = (konnectors: any[]) => {
  return konnectors.map((konnector) => {
    return {
      slug: konnector.slug,
      latest_version: {
        manifest: {
          vendor_link: konnector.uri,
        },
      },
    };
  });
};

const buildCiphers = (ciphers: any[]) => {
  return ciphers.map((cipher) => {
    const cipherView = new CipherView();
    cipherView.name = cipher.name;
    cipherView.type = CipherType.Login;
    if (cipher.uri) {
      cipherView.login = new LoginView();
      const loginUri = new LoginUriView();
      loginUri.uri = cipher.uri;
      cipherView.login.uris = [loginUri];
    }
    return cipherView;
  });
};

export class TestStorageService implements StorageService {
  get valuesRequireDeserialization(): boolean {
    throw new Error("Method not implemented.");
  }
  async get<T>(key: string): Promise<T> {
    return new Promise((resolve) => resolve(null));
  }

  async has(key: string): Promise<boolean> {
    return new Promise((resolve) => resolve(null));
  }

  async save(key: string, obj: any): Promise<any> {
    return new Promise((resolve) => resolve(null));
  }

  async remove(key: string): Promise<any> {
    return new Promise((resolve) => resolve(null));
  }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
/* @ts-ignore */
export class TestStateService implements StateService {
  async getDefaultUriMatch(): Promise<any> {
    return new Promise((resolve) => resolve(null));
  }
}

describe("Konnectors Service", () => {
  const settingsService: any = {
    settings$: of([]),
    getEquivalentDomains: () => {
      return Promise.resolve([]);
    },
  };
  const konnectorsService = new KonnectorsService(
    null,
    settingsService,
    null,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    /* @ts-ignore */
    new TestStateService(),
    null,
  );

  it("should suggest konnectors by full url match", async () => {
    const konnectors = buildKonnectors([{ slug: "ameli", uri: "http://ameli.fr/login" }]);
    const ciphers = buildCiphers([{ name: "Sécurité Sociale", uri: "http://ameli.fr/login" }]);
    const suggested = await konnectorsService.suggestedKonnectorsFromCiphers(
      konnectors,
      [],
      [],
      ciphers,
    );
    expect(suggested).toEqual(konnectors);
  });
  it("should suggest konnectors by hostname", async () => {
    const konnectors = buildKonnectors([{ slug: "ameli", uri: "ameli.fr" }]);
    const ciphers = buildCiphers([{ name: "Sécurité Sociale", uri: "http://ameli.fr/login" }]);
    const suggested = await konnectorsService.suggestedKonnectorsFromCiphers(
      konnectors,
      [],
      [],
      ciphers,
    );
    expect(suggested).toEqual(konnectors);

    const konnectors2 = buildKonnectors([{ slug: "ameli", uri: "http://ameli.fr/login" }]);
    const ciphers2 = buildCiphers([{ name: "Sécurité Sociale", uri: "ameli.fr" }]);
    const suggested2 = await konnectorsService.suggestedKonnectorsFromCiphers(
      konnectors2,
      [],
      [],
      ciphers2,
    );
    expect(suggested2).toEqual(konnectors2);
  });
  it("should suggest konnectors by domain", async () => {
    const konnectors = buildKonnectors([{ slug: "ameli", uri: "ameli.fr" }]);
    const ciphers = buildCiphers([{ name: "Sécurité Sociale", uri: "http://www.ameli.fr/login" }]);
    const suggested = await konnectorsService.suggestedKonnectorsFromCiphers(
      konnectors,
      [],
      [],
      ciphers,
    );
    expect(suggested).toEqual(konnectors);

    const konnectors2 = buildKonnectors([{ slug: "ameli", uri: "http://www.ameli.fr/login" }]);
    const ciphers2 = buildCiphers([{ name: "Sécurité Sociale", uri: "ameli.fr" }]);
    const suggested2 = await konnectorsService.suggestedKonnectorsFromCiphers(
      konnectors2,
      [],
      [],
      ciphers2,
    );
    expect(suggested2).toEqual(konnectors2);
  });
  it("should not suggest konnectors with close url", async () => {
    const konnectors = buildKonnectors([
      { slug: "Orange", uri: "orange.fr" },
      { slug: "cozy cloud", uri: "cozy.io" },
    ]);
    const ciphers = buildCiphers([
      { name: "fruit lover", uri: "http://fruitlover.fr/orange" },
      { name: "cozy cat", uri: "cozy.fr" },
    ]);
    const suggested = await konnectorsService.suggestedKonnectorsFromCiphers(
      konnectors,
      [],
      [],
      ciphers,
    );
    expect(suggested).toEqual([]);
  });
  it("should not suggest empty konnector", async () => {
    const konnectors = buildKonnectors([{ slug: "" }]);
    const ciphers = buildCiphers([{ name: "" }]);
    const suggested = await konnectorsService.suggestedKonnectorsFromCiphers(
      konnectors,
      [],
      [],
      ciphers,
    );
    expect(suggested).toEqual([]);
  });
  it("should not suggest installed or already suggested konnector", async () => {
    const konnectors = buildKonnectors([{ slug: "ameli" }, { slug: "amazon" }, { slug: "impots" }]);
    const ciphers = buildCiphers([{ name: "Ameli" }, { name: "amazon" }]);
    const installedKonnectors = buildKonnectors([{ slug: "ameli" }]);
    const suggestedKonnectors = buildKonnectors([{ slug: "amazon" }]);
    const suggested = await konnectorsService.suggestedKonnectorsFromCiphers(
      konnectors,
      installedKonnectors,
      suggestedKonnectors,
      ciphers,
    );
    expect(suggested).toEqual([]);
  });
});
