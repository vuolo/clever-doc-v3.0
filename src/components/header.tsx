import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { FileScan } from "lucide-react";

type Props = {
  selectedNav?: string;
};

export default function Header({ selectedNav }: Props): JSX.Element {
  const { data: sessionData } = useSession();

  return (
    <header className="container flex h-[70px] items-center justify-between py-4">
      <div className="flex gap-6 md:gap-10">
        <Link href="/" className="flex items-center space-x-2">
          <FileScan />
          <span className="hidden font-bold sm:inline-block">Clever Doc</span>
        </Link>
        <nav className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/tools/bsca"
            className={`text-sm font-${
              selectedNav == "BSCA" ? "bold" : "medium"
            } hover:underline`}
          >
            BSCA
          </Link>
        </nav>
      </div>
      <nav>
        <button
          onClick={sessionData ? () => signOut() : () => signIn()}
          className="relative inline-flex items-center rounded-md border border-transparent bg-mono-500 px-6 py-2 text-sm font-medium text-white shadow-md hover:bg-mono-400 focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2"
        >
          {sessionData ? "Sign out" : "Sign in"}
        </button>
      </nav>
    </header>
  );
}
