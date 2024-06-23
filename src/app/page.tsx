import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import Link from "next/link";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className="mx-auto border w-96 rounded p-6 my-6 border-gray-700">
      <div>Status: {session ? "authenticated" : "unauthenticated"}</div>
      {session ? (
        <>
          <pre className="overflow-y-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
          <Link
            href="/api/auth/signout"
            className="mt-3 inline-block rounded bg-blue-600 font-semibold px-2 py-1"
          >
            Logout
          </Link>
        </>
      ) : (
        <>
          <Link
            href="/api/auth/signin"
            className="mt-3 inline-block rounded bg-blue-600 font-semibold px-2 py-1"
          >
            Login
          </Link>
        </>
      )}
    </div>
  );
}
