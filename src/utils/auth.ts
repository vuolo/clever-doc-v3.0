export function userHasPermission(
  userPermissions: string[],
  requiredPermission: "admin" | "tools-bsca"
) {
  return (
    userPermissions.includes("admin") ||
    userPermissions.includes(requiredPermission)
  );
}
