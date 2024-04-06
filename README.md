# With Refresh Token

With Refresh Token is an wrapper middleware for Next.js that helps you to use refresh token to get new access token when the access token is expired.

## Usage

Install the package with your package manager of choice.

```bash
npm install with-refresh-token
```

Then import the function to get the middleware and **configure it with your own options**.

```ts
// src/lib/with-refresh-token.ts
import { getMiddleware } from "with-refresh-token";

export const withRefreshToken = getMiddleware({
  /* options */
});
```

Finally, import `withRefreshToken` and use it in your middleware stack.

```ts
// src/middleware.ts
import { withRefreshToken } from "./lib/with-refresh-token";

export const config = { /* config */ }; // see at the end the suggested `config`

function middleware(
  _req: NextRequest,
  res: NextResponse,
  _event: NextFetchEvent
) {
  // do other stuff here

  return res;
}

export default withRefreshToken(middleware);

// or just
// export default withRefreshToken();
```

### Options

The `getMiddleware` function takes an object with the following properties:

- `shouldRefresh: (req: NextRequest) => boolean` - A function that returns `true` if the access token should be refreshed.
- `fetchTokenPair: (req: NextRequest) => Promise<TokenPair>` - A function that fetches new token pair.
- `onSuccess: (res: NextResponse, tokenPair: TokenPair) => void` - A function that is called when the new token pair is fetched successfully.
- `onError?: (req: NextRequest, error: unknown) => void` - An optional function that is called when an error occurs.

### TokenPair

- `TokenPair` is an object with the following properties:
  - `accessToken: string` - The new access token.
  - `refreshToken: string` - The new refresh token.

## Default example

```ts
import { NextResponse } from "next/server";
import { getMiddleware } from "with-refresh-token";

const DEFAULT_OFFSET_SECONDS = 15; // refresh the token 15 seconds before it expires

export const withRefreshToken = getMiddleware({
  // get the jwt access token from the cookies through the original request
  // and check if it is expired
  shouldRefresh: (req) => {
    const accessToken = req.cookies.get("access-token")?.value;
    if (!accessToken) return true;
    try {
      const exp = jwtDecode(accessToken).exp; // decode the jwt and get the expiration time
      if (!exp) return true;
      return exp - DEFAULT_OFFSET_SECONDS <= Date.now() / 1000; // check if the token is expired
    } catch {
      return true;
    }
  },
  fetchTokenPair: async (req) => {
    // if true is returned from shouldRefresh, this function will be called
    // do whatever you need to get the new token pair
    const refreshToken = req.cookies.get("refresh-token")?.value;
    const response = await fetch("http://localhost:3000/api/refresh-token", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
      headers: { "Content-Type": "application/json" },
    });
    return await response.json(); // `TokenPair` object should be returned
  },
  onSuccess: (res, tokenPair) => {
    // with the new token pair, set the new access token and refresh token to the cookies
    // so that the next request and your Server Components can use the new token
    res.cookies.set({
      name: "access-token",
      value: tokenPair.accessToken,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    res.cookies.set({
      name: "refresh-token",
      value: tokenPair.refreshToken,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
  },
  onError: (_req, error) => {
    // optional function that is called when an error occurs
    // you can redirect the user to the login page if is unauthorized
    // if (error instanceof Response && error.status === 401) {
    //   return NextResponse.redirect(new URL("/login", req.url));
    // }
    console.error(error);
  },
});
```

### Suggested `config` for `middleware.ts`

This configuration suggestion is available in the Next.js documentation itself. It will prioritize the execution of the middleware on all accessed pages. Adapt it according to your middleware needs.

```ts
// ...

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      has: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      has: [{ type: "header", key: "x-present" }],
      missing: [{ type: "header", key: "x-missing", value: "prefetch" }],
    },
  ],
};

// ...
```

## Philosophy

The `with-refresh-token` middleware is designed to be as flexible as possible. It provides a way to refresh the access token when it is expired, but it does not enforce any specific way to do so. You can use any method to get the new token pair, as long as it returns a `TokenPair` object.
