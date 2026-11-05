// Initial credentials are stored as salted password hashes, never plaintext.
export const adminAccounts = [
  {
    phone: "+919973700894",
    passwordHash:
      "scrypt:1050d79d7aae923ca11b64e31c1c46cd:840501d127ba4ea70f3b7d53503ff7e1f17e1fa7edecc704dd86ec0e9fe52cd8282e31f1e1f9f5ae8b4418b04a1f3874c9a4d4a7466cbfd60f2ab6469c7867b7",
  },
  {
    phone: "+919308604097",
    passwordHash:
      "scrypt:c1417055ad3f982318c22cce92044429:3f054bac107a1cb74b9b51e1fe361f662b5cc93c6d915535dca2be2adbe1a6e89ad4221d06cca3345956f9280b1934c2121f1c5932a1527a85e0495fee6aaad2",
  },
] as const;
export const isAdminPhone = (phone: string) =>
  adminAccounts.some((a) => a.phone === phone);
