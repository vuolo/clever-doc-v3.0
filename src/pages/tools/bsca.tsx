import { type NextPage } from "next";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

import DynamicHead from "@/components/dynamic-head";
import Header from "@/components/header";
// import Main from "@/components/tools/bsca/main";
import { userHasPermission } from "@/utils/auth";

const BSCA: NextPage = () => {
  const { data: sessionData } = useSession();
  const userPermissions = sessionData?.user?.permissions ?? [];
  const permissionGranted = userHasPermission(userPermissions, "tools-bsca");

  return (
    <>
      <DynamicHead title="BSCA" />
      <Header selectedNav="BSCA" />
      <main className="flex h-[calc(100vh-70px)] items-center justify-center">
        {sessionData === null ? (
          <p>You must be signed in to access this tool.</p>
        ) : sessionData === undefined ? (
          <div className="flex space-x-2">
            <Loader2 className="animate-spin" />
            <p>Loading...</p>
          </div>
        ) : permissionGranted ? (
          <p>Welcome authenticated user</p> // <Main />
        ) : (
          <p>
            You do not have access to this tool. Please reach out to Michael @{" "}
            <u>michaelvuolo1@gmail.com</u> to request access.
          </p>
        )}
      </main>
    </>
  );
};

export default BSCA;
