import { type AppType } from "next/app";
import { type Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import "@fontsource/dm-sans";

import { trpc } from "@/utils/trpc";
import "@/styles/globals.css";

const MyApp: AppType<{ session: Session | null }> = ({
  Component,
  pageProps: { session, ...pageProps },
}) => {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#f8fafc",
          },
        }}
      />
    </SessionProvider>
  );
};

export default trpc.withTRPC(MyApp);
