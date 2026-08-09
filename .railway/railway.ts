import { defineRailway, github, mongo, project, service } from "railway/iac";

export default defineRailway(() => {
  const db = mongo("MongoDB");

  const server = service("Pool_railway", {
    source: github("mahdee123/Pool_railway"),
    rootDirectory: "server",
    buildCommand: "npm install",
    startCommand: "npm start",
    healthcheckPath: "/api/health",
    healthcheckTimeout: 100,
    variables: {
      NODE_ENV: "production",
      SYSTEM_MONGODB_URI: `${db.mongoUrl}`,
      JWT_SECRET: "1282cdec2254946647c14e6b646234243a13e65c354ef5075ce515ec7c687e71e88032442c1425cbf9803ae0969ccf6e",
      JWT_EXPIRY: "12h",
      ADMIN_EMAIL: "admin@raya.com",
      ADMIN_PASSWORD: "RayaPool2026!Secure",
    },
  });

  const client = service("client", {
    source: github("mahdee123/Pool_railway"),
    rootDirectory: "client",
    buildCommand: "npm install && npm run build",
    startCommand: "npm run start",
    variables: {
      VITE_API_URL: `https://${server.publicDomain}/api`,
    },
  });

  server.variables = {
    ...server.variables,
    ALLOWED_ORIGINS: `https://${client.publicDomain}`,
  };

  return project("easygoing-enchantment", {
    resources: [db, server, client],
  });
});
