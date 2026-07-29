import crypto from 'node:crypto';

// Attack IV: Server-Selection Sybil mitigation
// Verifies endpoint identities to prevent agents from being
// directed to malicious or fake endpoints

interface EndpointAttestation {
  hostname: string;
  publicKey: string;
  signature: string;
  timestamp: number;
}

const verifiedEndpoints = new Map<string, EndpointAttestation>();

export interface RegistryCheckResult {
  valid: boolean;
  reason?: string;
}

/**
 * Register a verified endpoint attestation.
 * In production, this would be loaded from a secure store or
 * fetched from a trusted registry.
 */
export function registerEndpoint(
  hostname: string,
  publicKey: string,
  signature: string
): boolean {
  const attestation: EndpointAttestation = {
    hostname,
    publicKey,
    signature,
    timestamp: Date.now()
  };

  verifiedEndpoints.set(hostname, attestation);
  return true;
}

/**
 * Check if an upstream endpoint is verified.
 * In strict mode (REGISTRY_STRICT=true), only registered endpoints are allowed.
 */
export function checkEndpoint(url: string): RegistryCheckResult {
  try {
    const hostname = new URL(url).hostname;

    // Skip check for localhost in development
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return { valid: true };
    }

    const strictMode = process.env.REGISTRY_STRICT === 'true';
    const attestation = verifiedEndpoints.get(hostname);

    if (!attestation) {
      if (strictMode) {
        return {
          valid: false,
          reason: `Endpoint ${hostname} is not in the verified registry. ` +
            'Set REGISTRY_STRICT=false to allow unregistered endpoints.'
        };
      }
      return {
        valid: true,
        reason: `Endpoint ${hostname} is not registered but strict mode is disabled. ` +
          'Set REGISTRY_STRICT=true to enforce endpoint verification.'
      };
    }

    // Verify the attestation signature
    const isValid = verifyAttestation(attestation);
    if (!isValid) {
      return {
        valid: false,
        reason: `Attestation for ${hostname} has an invalid signature.`
      };
    }

    // Check attestation age (max 24 hours)
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - attestation.timestamp > maxAge) {
      return {
        valid: false,
        reason: `Attestation for ${hostname} has expired (older than 24 hours).`
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid URL format.' };
  }
}

/**
 * Verify a cryptographic attestation.
 * Uses ECDSA signature verification. In dev mode, accepts any non-empty signature.
 */
function verifyAttestation(attestation: EndpointAttestation): boolean {
  if (!attestation.signature || attestation.signature.length < 10) {
    return false;
  }

  // In development mode, skip real signature verification
  // In production, this would use crypto.verify() with the public key
  if (process.env.NODE_ENV === 'production') {
    try {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(attestation.hostname + attestation.timestamp);
      return verifier.verify(
        attestation.publicKey,
        attestation.signature,
        'hex'
      );
    } catch {
      return false;
    }
  }

  return true;
}

export function clearRegistry(): void {
  verifiedEndpoints.clear();
}

export function getRegisteredEndpoints(): string[] {
  return Array.from(verifiedEndpoints.keys());
}
