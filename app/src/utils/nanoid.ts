import { customAlphabet } from "nanoid";

const alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const generateShareCode = customAlphabet(alphabet, 7);
