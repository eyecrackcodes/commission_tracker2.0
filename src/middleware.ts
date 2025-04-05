import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export default authMiddleware({
  publicRoutes: ["/"],
  afterAuth: async (auth, req) => {
    // Set up Supabase JWT template
    if (auth.userId) {
      const response = NextResponse.next();
      response.headers.set("x-clerk-user-id", auth.userId);
      return response;
    }
    return NextResponse.next();
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
