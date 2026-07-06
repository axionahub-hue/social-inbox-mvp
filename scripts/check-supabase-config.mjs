import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const requiredClientVars = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const requiredServerVars = ["SUPABASE_SERVICE_ROLE_KEY"];

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return env;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        return env;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

      env[key] = value;
      return env;
    }, {});
}

function getConfigValue(env, key) {
  return process.env[key] || env[key] || "";
}

function assertUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

async function checkHttp(name, url, headers) {
  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      return {
        ok: false,
        message: `${name}: HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      message: `${name}: OK`,
    };
  } catch (error) {
    return {
      ok: false,
      message: `${name}: ${error instanceof Error ? error.message : "error desconocido"}`,
    };
  }
}

async function main() {
  const env = parseEnvFile(envPath);
  const missingClientVars = requiredClientVars.filter((key) => !getConfigValue(env, key));
  const missingServerVars = requiredServerVars.filter((key) => !getConfigValue(env, key));
  const supabaseUrl = getConfigValue(env, "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getConfigValue(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = getConfigValue(env, "SUPABASE_SERVICE_ROLE_KEY");
  let hasError = false;

  console.log("Supabase config check");
  console.log(`- .env.local: ${existsSync(envPath) ? "found" : "missing"}`);

  if (missingClientVars.length > 0) {
    hasError = true;
    console.log(`- missing client vars: ${missingClientVars.join(", ")}`);
  } else {
    console.log("- client vars: present");
  }

  if (missingServerVars.length > 0) {
    hasError = true;
    console.log(`- missing server vars: ${missingServerVars.join(", ")}`);
  } else {
    console.log("- server vars: present");
  }

  if (supabaseUrl && !assertUrl(supabaseUrl)) {
    hasError = true;
    console.log("- NEXT_PUBLIC_SUPABASE_URL: invalid Supabase project URL");
  }

  if (supabaseUrl && anonKey) {
    const restResult = await checkHttp(`${supabaseUrl}/rest/v1`, `${supabaseUrl}/rest/v1/`, {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    });

    console.log(`- ${restResult.message}`);

    if (!restResult.ok) {
      hasError = true;
    }

    const authResult = await checkHttp(`${supabaseUrl}/auth/v1/settings`, `${supabaseUrl}/auth/v1/settings`, {
      apikey: anonKey,
    });

    console.log(`- ${authResult.message}`);

    if (!authResult.ok) {
      hasError = true;
    }
  }

  if (serviceRoleKey && anonKey && serviceRoleKey === anonKey) {
    hasError = true;
    console.log("- SUPABASE_SERVICE_ROLE_KEY: must be different from anon key");
  }

  if (hasError) {
    console.log("Result: Supabase is not ready for authenticated mode.");
    process.exit(1);
  }

  console.log("Result: Supabase config is reachable and ready for app validation.");
}

main();
