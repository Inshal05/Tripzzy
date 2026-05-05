const USER_TOKEN_KEY = 'user-token';
const CAPTAIN_TOKEN_KEY = 'captain-token';
const LEGACY_TOKEN_KEY = 'token';

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const readToken = (key) => {
  if (!canUseStorage()) {
    return '';
  }

  return localStorage.getItem(key) || '';
};

const writeToken = (key, token) => {
  if (!canUseStorage() || !token) {
    return;
  }

  localStorage.setItem(key, token);
};

const removeToken = (key) => {
  if (!canUseStorage()) {
    return;
  }

  localStorage.removeItem(key);
};

const buildAuthHeaders = (token) =>
  token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};

export const getLegacyToken = () => readToken(LEGACY_TOKEN_KEY);

export const isLegacyToken = (token) => Boolean(token) && token === getLegacyToken();

export const getUserToken = () => readToken(USER_TOKEN_KEY) || getLegacyToken();

export const getCaptainToken = () => readToken(CAPTAIN_TOKEN_KEY) || getLegacyToken();

export const getSharedMapToken = () => readToken(USER_TOKEN_KEY) || readToken(CAPTAIN_TOKEN_KEY) || getLegacyToken();

export const getUserAuthHeaders = () => buildAuthHeaders(getUserToken());

export const getCaptainAuthHeaders = () => buildAuthHeaders(getCaptainToken());

export const getSharedMapAuthHeaders = () => buildAuthHeaders(getSharedMapToken());

export const persistUserToken = (token) => {
  writeToken(USER_TOKEN_KEY, token);

  if (isLegacyToken(token)) {
    removeToken(LEGACY_TOKEN_KEY);
  }
};

export const persistCaptainToken = (token) => {
  writeToken(CAPTAIN_TOKEN_KEY, token);

  if (isLegacyToken(token)) {
    removeToken(LEGACY_TOKEN_KEY);
  }
};

export const clearUserToken = ({ includeLegacy = false } = {}) => {
  removeToken(USER_TOKEN_KEY);

  if (includeLegacy) {
    removeToken(LEGACY_TOKEN_KEY);
  }
};

export const clearCaptainToken = ({ includeLegacy = false } = {}) => {
  removeToken(CAPTAIN_TOKEN_KEY);

  if (includeLegacy) {
    removeToken(LEGACY_TOKEN_KEY);
  }
};
