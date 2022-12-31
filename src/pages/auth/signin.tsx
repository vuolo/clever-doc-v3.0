import { type ServerResponse } from "http";
import { type CtxOrReq } from "next-auth/client/_utils";
import { type Provider } from "next-auth/providers";
import {
  signIn,
  getCsrfToken,
  getProviders,
  getSession,
} from "next-auth/react";
import { FileScan } from "lucide-react";

import styles from "@/styles/auth/Signin.module.css";

type Props = {
  csrfToken: any;
  providers: Provider[];
};

const Signin = ({ csrfToken, providers }: Props) => {
  return (
    <div style={{ overflow: "hidden", position: "relative" }}>
      <div
        className={styles.wrapper}
        id="wrapper"
        // className="fixed top-0 left-0 z-[2] flex h-[150%] w-[70%] -translate-x-[20%] -translate-y-[10%] rotate-[11deg] items-center bg-[#002140] sm:w-[200%] md:-left-[50px] md:w-[80%]"
      />
      <div
        className={styles.content}
        id="content"
        // className="h-[calc(100vh - 64px)] relative z-[2] flex w-[100%] items-center p-[30px] text-center font-bold"
      >
        <div
          className={styles.cardWrapper}
          id="cardWrapper"
          // className="z-[3] ml-[15%] flex w-[400px] flex-col items-center justify-items-center text-lg"
        >
          <div className="mb-3 flex h-fit scale-150 text-black">
            <FileScan className="mr-2" />
            <h1 className="font-bold">Clever Doc</h1>
          </div>
          <div
            className={styles.cardContent}
            id="cardContent"
            // className="m-4 w-full rounded-md bg-white p-4 [&input]:relative [&input]:mx-4 [&input]:inline-block [&input]:w-full [&input]:rounded-md [&input]:border [&input]:border-[#d9d9d9] [&input]:bg-white [&input]:px-3 [&input]:py-1 [&input]:text-lg [&input]:text-black/60 [&input]:transition-all [&input]:duration-[300ms]"
          >
            {/* <input name="csrfToken" type="hidden" defaultValue={csrfToken} />
            <input placeholder="Email" />
            <button className={styles.primaryBtn}>Submit</button>
            <hr /> */}
            {providers &&
              Object.values(providers).map((provider) => (
                <div key={provider.name} style={{ marginBottom: 0 }}>
                  <button
                    onClick={() => signIn(provider.id)}
                    className="text-md inline-flex items-center justify-center rounded-md border border-transparent bg-brand-gold px-4 py-2 font-bold text-white shadow-md hover:bg-brand-gold-hover focus:outline-none focus:ring-2 focus:ring-mono-500 focus:ring-offset-2"
                  >
                    {getProviderIcon(provider.id)}
                    Sign in with {provider.name}
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/signin_pattern.svg"
        alt="Pattern Background"
        id="styledPattern"
        className={styles.styledPattern}
        // className="absolute top-0 right-0 z-[1] min-h-full min-w-full object-cover"
      />
    </div>
  );
};

export default Signin;

function getProviderIcon(id: string) {
  switch (id) {
    case "google":
      return (
        <svg
          className="mr-2 h-5 w-5 fill-white"
          fill="#000000"
          width="800px"
          height="800px"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z" />
        </svg>
      );
    case "apple":
      return <></>;
    default:
      return <></>;
  }
}

export async function getServerSideProps(
  context: CtxOrReq & { res: ServerResponse; query: any }
) {
  const providers = await getProviders();
  const csrfToken = await getCsrfToken(context);

  const { req, res, query } = context;
  const session = await getSession({ req });
  const { callbackUrl } = query;

  if (session && res && session.user?.id) {
    res.writeHead(302, {
      Location: callbackUrl,
    });
    res.end();
  }

  return {
    props: {
      providers,
      csrfToken,
    },
  };
}
