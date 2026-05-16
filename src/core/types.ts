export type RemoteOS = "windows" | "linux" | "macos" | "unknown";

export type ServiceKind = "docker-container" | "docker-compose" | "system-service";

export type ServiceStatus = "running" | "stopped" | "restarting" | "failed" | "unknown";

export type Service = {
  id: string;
  name: string;
  kind: ServiceKind;
  status: ServiceStatus;
  image?: string;
  ports?: string;
  health?: "healthy" | "unhealthy" | "starting" | "none" | "unknown";
  composeProject?: string;
  composeService?: string;
};

export type SystemInfo = {
  hostname: string;
  os: RemoteOS;
  cpuUsagePercent?: number;
  ram?: {
    totalBytes: number;
    usedBytes: number;
  };
  disks?: {
    name: string;
    totalBytes: number;
    freeBytes: number;
  }[];
};

export type MonitorSnapshot = {
  hostName: string;
  remoteOS: RemoteOS;
  system: SystemInfo;
  services: Service[];
  error?: string;
};

export type HostConfig = {
  name: string;
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
  discovery: {
    docker: boolean;
    nativeServices: boolean;
    includeStoppedContainers: boolean;
  };
};

export type AppConfig = {
  hosts: HostConfig[];
};
