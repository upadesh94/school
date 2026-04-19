const FIREBASE_AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1';

const DEFAULT_DEMO_PRINCIPAL = Object.freeze({
  email: 'principle@gmail.com',
  password: '123123',
  displayName: 'Principal Demo',
  username: 'principal',
});

function getDemoPrincipalCredentials() {
  return {
    email: String(process.env.DEMO_PRINCIPAL_EMAIL || DEFAULT_DEMO_PRINCIPAL.email).trim().toLowerCase(),
    password: String(process.env.DEMO_PRINCIPAL_PASSWORD || DEFAULT_DEMO_PRINCIPAL.password).trim(),
    displayName: String(process.env.DEMO_PRINCIPAL_NAME || DEFAULT_DEMO_PRINCIPAL.displayName).trim(),
    username: String(process.env.DEMO_PRINCIPAL_USERNAME || DEFAULT_DEMO_PRINCIPAL.username).trim(),
  };
}

function getFirebaseApiKey() {
  const apiKey = String(process.env.FIREBASE_API_KEY || '').trim();
  if (!apiKey) {
    const err = new Error('FIREBASE_API_KEY is missing. Firebase Auth cannot be used.');
    err.code = 'FIREBASE_AUTH_NOT_CONFIGURED';
    throw err;
  }
  return apiKey;
}

async function firebaseAuthRequest(endpoint, payload) {
  const apiKey = getFirebaseApiKey();
  const response = await fetch(`${FIREBASE_AUTH_BASE_URL}/${endpoint}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const err = new Error(data?.error?.message || 'Firebase Auth request failed');
    err.code = data?.error?.message || 'FIREBASE_AUTH_ERROR';
    throw err;
  }

  return data;
}

function normalizeAuthError(error) {
  return {
    ok: false,
    code: error?.code || 'FIREBASE_AUTH_ERROR',
    message: error?.message || 'Firebase authentication failed',
  };
}

async function signInWithFirebaseAuth(email, password) {
  try {
    if (!email || !password) {
      return {
        ok: false,
        code: 'MISSING_CREDENTIALS',
        message: 'Email and password are required',
      };
    }

    const authData = await firebaseAuthRequest('accounts:signInWithPassword', {
      email: String(email).trim().toLowerCase(),
      password: String(password),
      returnSecureToken: true,
    });

    return {
      ok: true,
      email: authData.email,
      localId: authData.localId,
      idToken: authData.idToken,
    };
  } catch (error) {
    return normalizeAuthError(error);
  }
}

async function ensureFirebaseAuthUser({ email, password, displayName = '' }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '').trim();
  const normalizedName = String(displayName || '').trim();

  if (!normalizedEmail || !normalizedPassword) {
    const err = new Error('Email and password are required to seed Firebase Auth user');
    err.code = 'INVALID_DEMO_CREDENTIALS';
    throw err;
  }

  try {
    const signUpData = await firebaseAuthRequest('accounts:signUp', {
      email: normalizedEmail,
      password: normalizedPassword,
      returnSecureToken: true,
    });

    if (normalizedName && signUpData.idToken) {
      await firebaseAuthRequest('accounts:update', {
        idToken: signUpData.idToken,
        displayName: normalizedName,
        returnSecureToken: true,
      });
    }

    return {
      created: true,
      email: signUpData.email || normalizedEmail,
      localId: signUpData.localId,
    };
  } catch (error) {
    if (error.code !== 'EMAIL_EXISTS') throw error;

    const signInResult = await signInWithFirebaseAuth(normalizedEmail, normalizedPassword);
    if (!signInResult.ok) {
      const mismatchError = new Error(
        `Firebase Auth user ${normalizedEmail} already exists but password does not match.`
      );
      mismatchError.code = 'EXISTING_USER_PASSWORD_MISMATCH';
      throw mismatchError;
    }

    if (normalizedName && signInResult.idToken) {
      try {
        await firebaseAuthRequest('accounts:update', {
          idToken: signInResult.idToken,
          displayName: normalizedName,
          returnSecureToken: true,
        });
      } catch (updateError) {
        // Display name sync failure should not block app startup.
        console.warn('Firebase displayName update skipped:', updateError.message);
      }
    }

    return {
      created: false,
      email: signInResult.email || normalizedEmail,
      localId: signInResult.localId,
    };
  }
}

module.exports = {
  getDemoPrincipalCredentials,
  signInWithFirebaseAuth,
  ensureFirebaseAuthUser,
};