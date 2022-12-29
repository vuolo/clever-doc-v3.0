import FileSidebar from "@/components/tools/bsca/file-sidebar";

export default function Main(): JSX.Element {
  return (
    <>
      <FileSidebar />
      <section className="flex h-full w-[100vw] flex-col items-center space-y-2 overflow-auto p-3">
        <p>main...</p>
      </section>
    </>
  );
}
