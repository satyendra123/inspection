import {jwtDecode} from "jwt-decode";

export type DecodedToken = {
  userID: number;
  name: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
};

export const decodeToken = (token: string): DecodedToken | null => {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
};

export const isTokenExpired = (token: string) => {
  const decoded = decodeToken(token);
  if (!decoded) return true;
  return decoded.exp * 1000 < Date.now();
};
