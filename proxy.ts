import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/",
  publicRoutes: ["/", "/volunteer", "/api", "/manifest.json", "/sw.js", "/icon.svg"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
