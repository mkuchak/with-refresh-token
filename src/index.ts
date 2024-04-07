import {
  RequestCookies,
  ResponseCookies,
} from "next/dist/compiled/@edge-runtime/cookies";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

export type NextMiddleware = (
  req: NextRequest,
  res: NextResponse,
  event: NextFetchEvent
) => NextResponse;

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type GetMiddlewareOptions = {
  shouldRefresh: (req: NextRequest) => boolean;
  fetchTokenPair: (req: NextRequest) => Promise<TokenPair>;
  onSuccess: (res: NextResponse, tokenPair: TokenPair) => void;
  onError?: (
    req: NextRequest,
    res: NextResponse,
    error: unknown
  ) => NextResponse | void;
};

export const applyCookiesOnNextResponse = (
  req: NextRequest,
  res: NextResponse
) => {
  const outgoingCookies = new ResponseCookies(res.headers);
  const incomingHeaders = new Headers(req.headers);
  const incomingCookies = new RequestCookies(incomingHeaders);

  outgoingCookies.getAll().forEach((cookie) => incomingCookies.set(cookie));

  const nextResponseHeaders = NextResponse.next({
    request: { headers: incomingHeaders },
  }).headers;

  nextResponseHeaders.forEach((value, key) => {
    if (
      key === "x-middleware-override-headers" ||
      key.startsWith("x-middleware-request-")
    ) {
      res.headers.set(key, value);
    }
  });
};

export const getMiddleware =
  ({
    shouldRefresh,
    fetchTokenPair,
    onSuccess,
    onError,
  }: GetMiddlewareOptions) =>
  (middlewareFn?: NextMiddleware) =>
  async (req: NextRequest, event: NextFetchEvent) => {
    const res = NextResponse.next();

    if (shouldRefresh(req)) {
      try {
        const tokenPair = await fetchTokenPair(req);
        onSuccess(res, tokenPair);
      } catch (error) {
        const next = onError?.(req, res, error);
        if (next) return next;
      }
    }

    applyCookiesOnNextResponse(req, res);

    return middlewareFn?.(req, res, event) ?? res;
  };
