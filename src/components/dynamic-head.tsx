import Head from "next/head";

type Props = {
  title?: string;
  overrideTitle?: boolean;
};

export default function DynamicHead({
  title,
  overrideTitle,
}: Props): JSX.Element {
  return (
    <Head>
      <title>
        {overrideTitle ? title : `Clever Doc${title ? " - " + title : ""}`}
      </title>

      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        name="description"
        content="Make unstructured documents work for you."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://cleverdoc.ai" />
      {/* <meta property="og:image" content="https://cleverdoc.ai/og.jpg" /> */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content="https://cleverdoc.ai" />
      {/* <meta property="twitter:image" content="https://cleverdoc.ai/og.jpg" /> */}

      {/* RealFaviconGenerator.net Favicon Package */}
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/apple-touch-icon.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href="/favicon-32x32.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="16x16"
        href="/favicon-16x16.png"
      />
      <link rel="manifest" href="/site.webmanifest" />
      <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#007a65" />
      <meta name="msapplication-TileColor" content="#007a65" />
      <meta name="theme-color" content="#ffffff" />
    </Head>
  );
}
