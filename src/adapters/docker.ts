import type { Service, ServiceStatus } from "../core/types.js";

type DockerInspect = {
  Id: string;
  Name: string;
  Config: { Image: string };
  State: {
    Running: boolean;
    Restarting: boolean;
    Dead: boolean;
    OOMKilled: boolean;
    Error: string;
    Health?: { Status: string };
  };
  NetworkSettings: {
    Ports: Record<string, Array<{ HostIp: string; HostPort: string }> | null>;
  };
  Labels: Record<string, string>;
};

function normalizeStatus(s: DockerInspect["State"]): ServiceStatus {
  if (s.Health?.Status === "unhealthy") return "failed";
  if (s.Health?.Status === "starting") return "restarting";
  if (s.Running) return "running";
  if (s.Restarting) return "restarting";
  if (s.Dead || s.OOMKilled || s.Error) return "failed";
  return "stopped";
}

function normalizePorts(
  ports: DockerInspect["NetworkSettings"]["Ports"]
): string {
  const entries: string[] = [];
  for (const [containerPort, bindings] of Object.entries(ports)) {
    if (!bindings) continue;
    for (const b of bindings) {
      entries.push(`${b.HostIp || "0.0.0.0"}:${b.HostPort}->${containerPort}`);
    }
  }
  return entries.join(", ");
}

function normalizeHealth(
  h?: string
): Service["health"] {
  if (!h) return "none";
  const map: Record<string, Service["health"]> = {
    healthy: "healthy",
    unhealthy: "unhealthy",
    starting: "starting",
    none: "none",
  };
  return map[h] ?? "unknown";
}

export async function getDockerServices(
  run: (cmd: string) => Promise<string>
): Promise<Service[]> {
  try {
    await run('docker version --format "{{.Server.Version}}"');
  } catch {
    return [];
  }

  let ids: string;
  try {
    ids = await run("docker ps -aq");
  } catch {
    return [];
  }

  const trimmed = ids.trim();
  if (!trimmed) return [];

  let raw: string;
  try {
    raw = await run(`docker inspect ${trimmed.split("\n").join(" ")}`);
  } catch {
    return [];
  }

  let containers: DockerInspect[];
  try {
    containers = JSON.parse(raw);
  } catch {
    return [];
  }

  return containers.map((c): Service => {
    const labels = c.Labels ?? {};
    const composeProject = labels["com.docker.compose.project"];
    const composeService = labels["com.docker.compose.service"];
    const ports = normalizePorts(c.NetworkSettings.Ports);

    return {
      id: c.Id.slice(0, 12),
      name: c.Name.replace(/^\//, ""),
      kind: composeProject ? "docker-compose" : "docker-container",
      status: normalizeStatus(c.State),
      image: c.Config.Image,
      ports: ports || undefined,
      health: normalizeHealth(c.State.Health?.Status),
      composeProject,
      composeService,
    };
  });
}

export async function restartDockerService(
  run: (cmd: string) => Promise<string>,
  service: Service
): Promise<void> {
  if (service.composeProject && service.composeService) {
    await run(`docker compose -p ${service.composeProject} restart ${service.composeService}`);
  } else {
    await run(`docker restart ${service.name}`);
  }
}

export async function restartDockerStack(
  run: (cmd: string) => Promise<string>,
  service: Service
): Promise<void> {
  if (!service.composeProject) throw new Error("Not a compose service");
  await run(`docker compose -p ${service.composeProject} restart`);
}

export async function stopDockerService(
  run: (cmd: string) => Promise<string>,
  service: Service
): Promise<void> {
  if (service.composeProject && service.composeService) {
    await run(`docker compose -p ${service.composeProject} stop ${service.composeService}`);
  } else {
    await run(`docker stop ${service.name}`);
  }
}

export async function startDockerService(
  run: (cmd: string) => Promise<string>,
  service: Service
): Promise<void> {
  if (service.composeProject && service.composeService) {
    await run(`docker compose -p ${service.composeProject} start ${service.composeService}`);
  } else {
    await run(`docker start ${service.name}`);
  }
}

export async function getDockerLogs(
  run: (cmd: string) => Promise<string>,
  service: Service,
  lines = 100
): Promise<string> {
  return run(`docker logs --tail ${lines} ${service.name}`);
}

export function streamDockerLogs(
  stream: (cmd: string, onData: (chunk: string) => void, onClose?: (code: number | null) => void) => Promise<() => void>,
  service: Service,
  onData: (chunk: string) => void,
  onClose?: (code: number | null) => void
): Promise<() => void> {
  return stream(`docker logs -f --tail 200 ${service.name}`, onData, onClose);
}
