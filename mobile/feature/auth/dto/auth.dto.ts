import { z } from "zod/v4";

export const GetTokenRequestDto = z.object({
  address: z.string().min(1, "Wallet address is required"),
});

export const CheckUserRequestDto = z.object({
  address: z.string().min(1, "Wallet address is required"),
});

export const RefreshTokenRequestDto = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export type GetTokenRequest = z.infer<typeof GetTokenRequestDto>;
export type CheckUserRequest = z.infer<typeof CheckUserRequestDto>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestDto>;
