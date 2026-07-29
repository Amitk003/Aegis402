// Attack I-B: Settlement Preemption mitigation
// Enforces EIP-712 caller binding to prevent front-running

const FACILITATOR_ADDRESS = process.env.FACILITATOR_ADDRESS || '';

export interface BindingCheckResult {
  valid: boolean;
  reason?: string;
}

/**
 * Check that a payment payload has proper caller binding.
 * The EIP-712 domain or Permit2 authorization must restrict
 * who can submit the transaction to the blockchain.
 *
 * Without this check, anyone who sees the signed payload can
 * front-run the facilitator by submitting it first.
 */
export function checkCallerBinding(
  payload: Record<string, unknown>,
  accepted: { network?: string }
): BindingCheckResult {
  // Extract the authorization payload from the x402 payload
  const authorization = payload.authorization
    || payload.permit2
    || payload.transferWithAuthorization
    || payload;

  const authObj = typeof authorization === 'object' && authorization !== null
    ? authorization as Record<string, unknown>
    : {};

  // Check for standard EIP-3009 caller restriction fields
  const callerField = findCallerField(authObj);
  if (callerField) {
    return validateCaller(callerField.value, callerField.field);
  }

  // Check for Permit2-specific fields
  const permitted = authObj.permitted || authObj.details;
  if (permitted && typeof permitted === 'object') {
    const permitCaller = (permitted as Record<string, unknown>).caller;
    if (permitCaller && typeof permitCaller === 'string') {
      return validateCaller(permitCaller, 'permitted.caller');
    }
  }

  // Check for EIP-712 domain separator
  const domain = authObj.domain || payload.domain;
  if (domain && typeof domain === 'object') {
    const domainObj = domain as Record<string, unknown>;
    const verifyingContract = domainObj.verifyingContract;
    if (verifyingContract && typeof verifyingContract === 'string') {
      return validateCaller(verifyingContract, 'domain.verifyingContract');
    }
  }

  // No caller restriction found - this payment can be front-run
  if (!FACILITATOR_ADDRESS) {
    return {
      valid: true,
      reason: 'No caller restriction found, but FACILITATOR_ADDRESS is not set. Binding check skipped.'
    };
  }

  return {
    valid: false,
    reason: 'No caller restriction found in payment payload. Anyone can submit this transaction. ' +
      'The payment must include a caller binding to prevent settlement preemption.'
  };
}

function findCallerField(
  obj: Record<string, unknown>
): { field: string; value: string } | null {
  // Check common field names for caller restriction
  const callerFieldNames = ['caller', 'authorized', 'authorizedCaller', 'spender', 'operator'];

  for (const field of callerFieldNames) {
    const value = obj[field];
    if (typeof value === 'string' && value.length > 0) {
      return { field, value };
    }
  }

  return null;
}

function validateCaller(
  callerAddress: string,
  field: string
): BindingCheckResult {
  if (!FACILITATOR_ADDRESS) {
    // If no facilitator address configured, warn but allow
    return {
      valid: true,
      reason: `Caller bound to ${shortAddress(callerAddress)} via ${field}, but FACILITATOR_ADDRESS is not set. Binding not enforced.`
    };
  }

  if (callerAddress.toLowerCase() === FACILITATOR_ADDRESS.toLowerCase()) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `Caller mismatch: payload is bound to ${shortAddress(callerAddress)} via ${field}, ` +
      `but the Aegis402 facilitator is at ${shortAddress(FACILITATOR_ADDRESS)}.`
  };
}

function shortAddress(address: string): string {
  if (address.length <= 10) return address;
  return address.slice(0, 6) + '...' + address.slice(-4);
}
