import forge from "node-forge";

/**
 * Creates a self-signed RSA-2048 test certificate packed as PKCS#12,
 * comparable to a beA software certificate. Key generation is slow,
 * so call this once per test file.
 */
export function erzeugeTestP12(
  pin: string,
  gueltigkeit: { von: Date; bis: Date } = {
    von: new Date(Date.UTC(2026, 0, 1)),
    bis: new Date(Date.UTC(2028, 11, 31, 23, 59, 59)),
  }
): {
  p12: Buffer;
  privateKeyPem: string;
  zertifikatPem: string;
} {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "0a1b2c3d";
  cert.validity.notBefore = gueltigkeit.von;
  cert.validity.notAfter = gueltigkeit.bis;
  const attrs = [
    { name: "commonName", value: "Max Müller", valueTagClass: forge.asn1.Type.UTF8 },
    { name: "organizationName", value: "Kanzlei Test" },
    { name: "countryName", value: "DE" },
  ];
  // node-forge typings do not include valueTagClass
  cert.setSubject(attrs as forge.pki.CertificateField[]);
  cert.setIssuer(attrs as forge.pki.CertificateField[]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], pin, {
    algorithm: "3des",
    friendlyName: "beA Test",
  });
  const p12 = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), "binary");

  return {
    p12,
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    zertifikatPem: forge.pki.certificateToPem(cert),
  };
}
