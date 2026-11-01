import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/*
  Supabase mode only: refreshes the Supabase Auth session cookie on page
  navigations.  In demo mode it is a no-op.  API routes are excluded so that
  large uploads are not buffered by the proxy.
*/
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || process.env.MSW_MODE === "demo" || !process.env.DATABASE_URL) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|icons/|sw.js|offline.html|pdf.worker|manifest.webmanifest|icon.svg|apple-icon.png).*)"],
};
