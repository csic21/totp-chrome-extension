import { hostnameToPermissionOrigins } from "./pinned-hosts";

export const hasPinnedHostPermission = async (
  hostname: string,
): Promise<boolean> => {
  const origins = hostnameToPermissionOrigins(hostname);
  return chrome.permissions.contains({ origins });
};

export const requestPinnedHostPermission = async (
  hostname: string,
): Promise<boolean> => {
  const origins = hostnameToPermissionOrigins(hostname);
  const alreadyGranted = await chrome.permissions.contains({ origins });
  if (alreadyGranted) {
    return true;
  }

  return chrome.permissions.request({ origins });
};

export const filterHostsWithPermission = async (
  hosts: string[],
): Promise<string[]> => {
  const granted: string[] = [];

  for (const host of hosts) {
    if (await hasPinnedHostPermission(host)) {
      granted.push(host);
    }
  }

  return granted;
};

export const collectOriginsNeedingPermission = async (
  hosts: string[],
): Promise<string[]> => {
  const origins = new Set<string>();

  for (const host of hosts) {
    if (await hasPinnedHostPermission(host)) {
      continue;
    }

    for (const origin of hostnameToPermissionOrigins(host)) {
      origins.add(origin);
    }
  }

  return [...origins];
};

export const requestMissingPinnedHostPermissions = async (
  hosts: string[],
): Promise<boolean> => {
  const uniqueHosts = [...new Set(hosts.map((host) => host.trim()).filter(Boolean))];
  if (uniqueHosts.length === 0) {
    return true;
  }

  const origins = await collectOriginsNeedingPermission(uniqueHosts);
  if (origins.length === 0) {
    return true;
  }

  return chrome.permissions.request({ origins });
};